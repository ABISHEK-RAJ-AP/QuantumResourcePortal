"""FastAPI application factory (LLD §4.2, §13.7 start-up order).

Start-up: validate configuration → logging → database pool → mount routers → ready.
Routers for each service are added here phase by phase under the ``/api/v1`` prefix.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from qre.core.config import APP_VERSION, Settings, get_settings
from qre.core.db import Database
from qre.core.logging import configure_logging
from qre.gateway import health
from qre.gateway.middleware.correlation import CorrelationMiddleware
from qre.gateway.problem import install_problem_handlers

API_PREFIX = "/api/v1"
log = logging.getLogger("qre.app")


def build_api_router(settings: Settings | None = None) -> APIRouter:
    """Versioned API router. Service routers are included here as phases land."""
    from qre.services.svc02_identity.admin_api import authz_router
    from qre.services.svc02_identity.admin_api import router as admin_router
    from qre.services.svc02_identity.api import ping_router
    from qre.services.svc02_identity.api import router as identity_router
    from qre.services.svc17_audit.api import router as audit_router

    router = APIRouter(prefix=API_PREFIX)
    router.include_router(identity_router)  # /auth/*, /me* (RBAC-4)
    router.include_router(ping_router)      # demo authorisation gates (RBAC-4)
    router.include_router(admin_router)     # /admin/* roles, permissions, users, memberships
    router.include_router(authz_router)     # /authz/check (RBAC-5)
    router.include_router(audit_router)     # /rbac/audit read/export/verify (RBAC-8)
  # Governance module routes (inventory, approvals, …) are added per service slice on this same API.
    return router


# API sub-paths reachable without a session (LLD §4.2 public allow-list). Everything else on the
# versioned API router must carry an authorisation dependency — asserted at start-up. Health probes
# live on a separate router and are intentionally public, so they are not part of this check.
PUBLIC_API_SUFFIXES = frozenset({"/auth/login"})


def _iter_api_routes(routes: object):
    """Yield concrete APIRoute objects, descending through lazily-included router wrappers."""
    for route in routes or []:
        inner = getattr(route, "original_router", None)
        if inner is not None:  # a lazily-included router wrapper (this FastAPI build)
            yield from _iter_api_routes(getattr(inner, "routes", []))
        elif getattr(route, "dependant", None) is not None and hasattr(route, "path"):
            yield route


def assert_api_router_guarded(api_router: APIRouter) -> list[str]:
    """Return API routes that are neither public nor protected by an auth dependency (deny default).

    A non-empty result is a configuration error: a protected route shipped without a guard. Paths
    the router-relative sub-paths (the /api/v1 prefix is applied by the mount).
    """
    from qre.core.deps import get_ctx

    unguarded: list[str] = []
    for route in _iter_api_routes(api_router.routes):
        if route.path in PUBLIC_API_SUFFIXES:
            continue
        if get_ctx not in _dependency_calls(route.dependant):
            methods = ','.join(sorted(getattr(route, 'methods', []) or []))
            unguarded.append(f"{methods} {route.path}")
    return unguarded


def _dependency_calls(dependant: object, seen: set | None = None) -> set:
    """Flatten the call objects of a route's dependency tree."""
    seen = seen if seen is not None else set()
    call = getattr(dependant, "call", None)
    if call is not None:
        seen.add(call)
    for sub in getattr(dependant, "dependencies", []) or []:
        _dependency_calls(sub, seen)
    return seen


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()  # raises on invalid configuration (LLD §13.9)
    configure_logging(settings.log_level, settings.log_format.value)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.db = Database(settings)
        log.info("api starting", extra={"env": settings.env.value, "version": APP_VERSION})
        try:
            yield
        finally:
            await app.state.db.dispose()
            log.info("api stopped")

    app = FastAPI(
        title="Quantum Resource Portal API",
        version=APP_VERSION,
        summary="QRE governance workspace (QRP) — versioned JSON API",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings

    install_problem_handlers(app)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,  # explicit list only, never "*"
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=[
                "Content-Type",
                "X-CSRF-Token",
                "Idempotency-Key",
                "If-Match",
                "X-Correlation-ID",
            ],
            expose_headers=["X-Correlation-ID", "Retry-After"],
        )
    # Added last = outermost: every response (including CORS and errors) gets a correlation id.
    app.add_middleware(CorrelationMiddleware)

    app.include_router(health.router)
    api_router = build_api_router(settings)
    app.include_router(api_router)

    # Deny by default: start-up fails if a protected API route lacks an auth dependency (plan §5.3).
    unguarded = assert_api_router_guarded(api_router)
    if unguarded:
        raise RuntimeError(
            "Unguarded API routes (missing get_ctx / require_* dependency): " + "; ".join(unguarded)
        )
    return app
