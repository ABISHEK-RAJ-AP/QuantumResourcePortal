"""Readiness and baseline schema against a real PostgreSQL test database."""

import pytest
from alembic import command
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from qre.core.config import Settings
from qre.gateway.app import create_app
from tests.conftest import alembic_config, run_alembic

pytestmark = pytest.mark.db


async def test_readyz_is_ready_at_migration_head(migrated_db, client):
    response = await client.get("/readyz")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"]["ok"] is True
    assert body["checks"]["migrations"]["detail"].startswith("at head")


async def test_readyz_reports_pending_migrations(migrated_db, client):
    cfg = alembic_config()
    run_alembic(command.downgrade, cfg, "base")
    try:
        response = await client.get("/readyz")
        assert response.status_code == 503
        checks = response.json()["checks"]
        assert checks["database"]["ok"] is True
        assert checks["migrations"]["ok"] is False
    finally:
        run_alembic(command.upgrade, cfg, "head")


async def test_readyz_reports_unreachable_database(settings):
    broken = Settings(
        _env_file=None,
        database_url="postgresql+asyncpg://nobody:nothing@127.0.0.1:1/none",
        readiness_db_timeout_ms=500,
    )
    from httpx import ASGITransport, AsyncClient

    app = create_app(broken)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as http:
            response = await http.get("/readyz")
    assert response.status_code == 503
    body = response.json()
    assert body["checks"]["database"]["ok"] is False
    assert body["checks"]["migrations"]["detail"].startswith("skipped")


async def test_baseline_schema_objects_exist(migrated_db):
    engine = create_async_engine(migrated_db)
    try:
        async with engine.connect() as conn:
            assert await conn.scalar(text("SELECT to_regclass('public.tenant')")) == "tenant"
            ext = await conn.scalar(
                text("SELECT extname FROM pg_extension WHERE extname = 'btree_gist'")
            )
            assert ext == "btree_gist"
            fn = await conn.scalar(
                text("SELECT proname FROM pg_proc WHERE proname = 'qre_append_only'")
            )
            assert fn == "qre_append_only"
            constraints = set(
                (
                    await conn.execute(
                        text(
                            "SELECT conname FROM pg_constraint WHERE conrelid = 'tenant'::regclass"
                        )
                    )
                ).scalars()
            )
            assert {"pk_tenant", "uq_tenant_1"} <= constraints
    finally:
        await engine.dispose()
