"""Database access: async engine, sessions and readiness checks (LLD §4.1, §7.9, §13.6).

* One async engine per process (asyncpg driver).
* ``Base`` is the declarative base for every ORM model; table and constraint names follow
  the LLD Appendix B conventions (pk_<table>, uq_<table>_<n>, fk_<table>_<n>, ck_<table>_<n>).
* Tenant scoping (repository predicate) and the UnitOfWork arrive in Phase 3 and build on
  :func:`set_tenant_guc`.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from qre.core.config import BACKEND_DIR, Settings

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base for all QRE ORM models."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


@dataclass(frozen=True, slots=True)
class CheckResult:
    ok: bool
    detail: str


class Database:
    """Owns the engine and session factory for the lifetime of the application."""

    def __init__(self, settings: Settings, *, application_name: str = "qre-api") -> None:
        self.settings = settings
        self.engine: AsyncEngine = create_async_engine(
            settings.database_url.get_secret_value(),
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            connect_args={
                "server_settings": {
                    "application_name": application_name,
                    "statement_timeout": str(settings.api_statement_timeout_ms),
                    "timezone": "UTC",
                }
            },
        )
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def session(self) -> AsyncIterator[AsyncSession]:
        """FastAPI dependency body: one session per request, always closed."""
        async with self.sessionmaker() as session:
            yield session

    async def ping(self) -> CheckResult:
        """`SELECT 1` within the readiness timeout (LLD §13.6: DB reachable within 2 s)."""
        timeout = self.settings.readiness_db_timeout_ms / 1000
        try:
            async with asyncio.timeout(timeout):
                async with self.engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
            return CheckResult(True, "reachable")
        except TimeoutError:
            return CheckResult(False, f"no response within {timeout:.1f}s")
        except Exception as exc:  # noqa: BLE001 — readiness must report, not raise
            return CheckResult(False, type(exc).__name__)

    async def current_revision(self) -> str | None:
        """Revision recorded in the database's ``alembic_version`` table (None if absent)."""
        async with self.engine.connect() as conn:
            exists = await conn.scalar(text("SELECT to_regclass('public.alembic_version')"))
            if exists is None:
                return None
            return await conn.scalar(text("SELECT version_num FROM alembic_version LIMIT 1"))

    async def migration_check(self) -> CheckResult:
        """LLD §13.6: migration head in the database must equal the code head."""
        expected = code_head_revision()
        try:
            actual = await self.current_revision()
        except Exception as exc:  # noqa: BLE001
            return CheckResult(False, f"cannot read revision ({type(exc).__name__})")
        if actual == expected:
            return CheckResult(True, f"at head {expected}")
        return CheckResult(False, f"database at {actual or 'none'}, code head {expected}")

    async def dispose(self) -> None:
        await self.engine.dispose()


@lru_cache
def code_head_revision() -> str | None:
    """Head revision of the Alembic scripts shipped with this code."""
    cfg = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return ScriptDirectory.from_config(cfg).get_current_head()


async def set_tenant_guc(session: AsyncSession, tenant_id: str) -> None:
    """Bind the tenant for PostgreSQL RLS policies for the current transaction (PD-44)."""
    await session.execute(
        text("SELECT set_config('qre.tenant_id', :tenant_id, true)"), {"tenant_id": tenant_id}
    )
