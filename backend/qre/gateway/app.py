"""FastAPI application factory (LLD §4.2, §13.7 start-up order).

Start-up: validate configuration → logging → database pool → mount routers → ready.
Routers for each service are added here phase by phase under the ``/api/v1`` prefix.
"""

from __future__ import annotations

import asyncio
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
from qre.gateway.middleware.security_headers import SecurityHeadersMiddleware
from qre.gateway.problem import install_problem_handlers

API_PREFIX = "/api/v1"
log = logging.getLogger("qre.app")


def build_api_router(settings: Settings | None = None) -> APIRouter:
    """Versioned API router. Service routers are included here as phases land."""
    from qre.services.svc02_identity.admin_api import authz_router
    from qre.services.svc02_identity.admin_api import router as admin_router
    from qre.services.svc02_identity.api import ping_router
    from qre.services.svc02_identity.api import router as identity_router
    from qre.services.svc03_projects.api import router as projects_router
    from qre.services.svc04_inventory.api import router as inventory_router
    from qre.services.svc05_quotas.api import router as quotas_router
    from qre.services.svc06_approvals.api import router as approvals_router
    from qre.services.svc07_scheduling.api import router as scheduling_router
    from qre.services.svc08_dispatch.api import router as dispatch_router
    from qre.services.svc09_ops.api import router as ops_router
    from qre.services.svc14_metering.api import router as metering_router
    from qre.services.svc15_alerts.api import router as alerts_router
    from qre.services.svc17_audit.api import router as audit_router
    from qre.services.svc18_governance_audit.api import router as governance_audit_router

    router = APIRouter(prefix=API_PREFIX)
    router.include_router(identity_router)  # /auth/*, /me* (RBAC-4)
    router.include_router(ping_router)      # demo authorisation gates (RBAC-4)
    router.include_router(admin_router)     # /admin/* roles, permissions, users, memberships
    router.include_router(authz_router)     # /authz/check (RBAC-5)
    router.include_router(audit_router)     # /rbac/audit read/export/verify (RBAC-8)
    router.include_router(projects_router)  # /projects list/create/detail
    router.include_router(inventory_router)  # /inventory/assets
    router.include_router(quotas_router)  # /quotas/ledger, /quotas/evaluate
    router.include_router(approvals_router)  # workloads, approvals, /governance/summary
    router.include_router(scheduling_router)  # /reservations holds
    router.include_router(dispatch_router)  # jobs, dispatch attempts, ICD
    router.include_router(ops_router)  # operations centre, governance activity
    router.include_router(metering_router)  # meter rollups
    router.include_router(alerts_router)  # alerts + summary
    router.include_router(governance_audit_router)  # /governance/audit-events
    if settings.is_lab:
        from qre.seed.api import router as demo_seed_router
        from qre.seed.simulation_api import router as demo_sim_router
        from qre.services.workspace_lab.api import router as workspace_lab_router

        router.include_router(workspace_lab_router)  # lab Home KPIs until module slices land
        router.include_router(demo_seed_router)  # POST /admin/seed-demo (lab only)
        router.include_router(demo_sim_router)  # demo simulation (lab only)
    return router


# API sub-paths reachable without a session (LLD §4.2 public allow-list). Everything else on the
# versioned API router must carry an authorisation dependency — asserted at start-up. Health probes
# live on a separate router and are intentionally public, so they are not part of this check.
PUBLIC_API_SUFFIXES = frozenset({
    "/auth/login",
    "/auth/captcha",
    "/auth/capabilities",
    "/auth/password/reset",
    "/auth/session",
})


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
        if settings.is_lab and settings.auto_seed_demo:
            try:
                async with app.state.db.sessionmaker() as session:
                    from qre.seed.auto import run_auto_seed_demo

                    await session.run_sync(lambda conn: run_auto_seed_demo(conn, settings))
                    await session.commit()
            except Exception:
                log.warning("startup demo seed could not run (is PostgreSQL up?)", exc_info=True)
        tick_task: asyncio.Task | None = None

        async def _simulation_loop() -> None:
            from qre.seed.simulation import tick_all_enabled_tenants

            while True:
                await asyncio.sleep(45)
                try:
                    async with app.state.db.sessionmaker() as session:
                        await session.run_sync(tick_all_enabled_tenants)
                        await session.commit()
                except Exception:  # noqa: BLE001
                    log.warning("demo simulation tick failed", exc_info=True)

        if settings.is_lab:
            tick_task = asyncio.create_task(_simulation_loop())

        try:
            yield
        finally:
            if tick_task is not None:
                tick_task.cancel()
                try:
                    await tick_task
                except asyncio.CancelledError:
                    pass
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
    # Added last = outermost: correlation id + baseline security headers on every response.
    app.add_middleware(SecurityHeadersMiddleware)
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
