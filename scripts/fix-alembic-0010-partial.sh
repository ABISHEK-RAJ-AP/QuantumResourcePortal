#!/usr/bin/env bash
# Reset partial migration 0010 (provider table created, backend/index missing) then re-run migrate.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/scripts/vm-pull-main.sh"
cd "$ROOT/backend"
set -a
# shellcheck disable=SC1091
source .env 2>/dev/null || true
set +a
export PATH="${HOME}/miniforge3/bin:/usr/bin:/bin:${PATH}"
"$ROOT/backend/.venv/bin/python" <<'PY'
import asyncio
import os

import asyncpg
from sqlalchemy.engine.url import make_url

raw = os.environ.get(
    "QRE_DATABASE_URL",
    "postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre",
)
url = make_url(raw)


async def main() -> None:
    conn = await asyncpg.connect(
        user=url.username or "qre_app",
        password=url.password or "",
        host=url.host or "localhost",
        port=url.port or 5432,
        database=(url.database or "qre").lstrip("/"),
    )
    try:
        ver = await conn.fetchval("SELECT version_num FROM alembic_version")
        print("alembic_version before:", ver)
        has_provider = await conn.fetchval(
            "SELECT to_regclass('public.catalogue_provider')"
        )
        if has_provider:
            print("Dropping catalogue_provider / catalogue_backend …")
            await conn.execute("DROP TABLE IF EXISTS catalogue_backend CASCADE")
            await conn.execute("DROP TABLE IF EXISTS catalogue_provider CASCADE")
        if ver == "0010":
            await conn.execute("UPDATE alembic_version SET version_num = '0009'")
            print("Reset alembic_version to 0009")
    finally:
        await conn.close()


asyncio.run(main())
PY
cd "$ROOT"
make migrate
echo "Done. Current revision:"
(cd backend && .venv/bin/alembic current)