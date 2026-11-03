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


def build_api_router() -> APIRouter:
    """Versioned API router. Service routers are included here as phases land."""
    router = APIRouter(prefix=API_PREFIX)
    # Phase 3+: router.include_router(svc02_identity.api.router) …
    return router


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
    app.include_router(build_api_router())
    return app
