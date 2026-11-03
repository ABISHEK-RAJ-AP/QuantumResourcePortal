"""Shared test fixtures.

Safety: before any application module is imported, ``QRE_DATABASE_URL`` is pointed at the
*test* database (``QRE_TEST_DATABASE_URL``), so the test suite can never touch development data.
Tests marked ``db`` are skipped with a clear message when the test database is unreachable.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_file_env = _read_env_file(BACKEND_DIR / ".env")
TEST_DATABASE_URL = os.environ.get("QRE_TEST_DATABASE_URL") or _file_env.get(
    "QRE_TEST_DATABASE_URL",
    "postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre_test",
)
os.environ["QRE_DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("QRE_ENV", "lab")
os.environ.setdefault("QRE_LOG_FORMAT", "text")
os.environ.setdefault("QRE_LOG_LEVEL", "WARNING")

# Imported only after the environment is prepared.
from alembic import command  # noqa: E402
from alembic.config import Config as AlembicConfig  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from qre.core.config import Settings, get_settings  # noqa: E402
from qre.gateway.app import create_app  # noqa: E402


def alembic_config(url: str = TEST_DATABASE_URL) -> AlembicConfig:
    cfg = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.attributes["configure_logger"] = False
    return cfg


async def _database_reachable(url: str) -> bool:
    engine = create_async_engine(url)
    try:
        async with asyncio.timeout(3):
            async with engine.connect():
                return True
    except Exception:  # noqa: BLE001
        return False
    finally:
        await engine.dispose()


def run_alembic(fn, *args) -> None:
    """Alembic's env.py calls asyncio.run(); run it in a worker thread (no running loop there)."""
    import threading

    errors: list[BaseException] = []

    def target() -> None:
        try:
            fn(*args)
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    thread = threading.Thread(target=target)
    thread.start()
    thread.join()
    if errors:
        raise errors[0]


@pytest.fixture(scope="session")
def settings() -> Settings:
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture(scope="session")
async def migrated_db() -> AsyncIterator[str]:
    """Fresh schema at head on the test database: downgrade to base, then upgrade to head."""
    if not await _database_reachable(TEST_DATABASE_URL):
        pytest.skip(
            "Test database not reachable. Create it (docs/PHASE_1_GUIDE.md, step 9) "
            "or set QRE_TEST_DATABASE_URL."
        )
    cfg = alembic_config()
    run_alembic(command.downgrade, cfg, "base")
    run_alembic(command.upgrade, cfg, "head")
    yield TEST_DATABASE_URL


@pytest.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    """HTTP client against a fully started app (lifespan included)."""
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http:
            http.app = app  # type: ignore[attr-defined]  # lets tests add routes
            yield http
