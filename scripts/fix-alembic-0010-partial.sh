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
DB="${QRE_DATABASE_URL:-postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre}"
# sync URL for psql-style admin via Python
export PATH="${HOME}/miniforge3/bin:/usr/bin:/bin:${PATH}"
"$ROOT/backend/.venv/bin/python" <<'PY'
import os
import re
from sqlalchemy import create_engine, text

raw = os.environ.get("QRE_DATABASE_URL", "postgresql+asyncpg://qre_app:qre_dev_password@localhost:5432/qre")
sync = re.sub(r"\+asyncpg", "", raw)
eng = create_engine(sync)
with eng.begin() as c:
    ver = c.execute(text("SELECT version_num FROM alembic_version")).scalar()
    print("alembic_version before:", ver)
    if c.execute(text("SELECT to_regclass('public.catalogue_provider')")).scalar():
        print("Dropping catalogue_provider / catalogue_backend …")
        c.execute(text("DROP TABLE IF EXISTS catalogue_backend CASCADE"))
        c.execute(text("DROP TABLE IF EXISTS catalogue_provider CASCADE"))
    if ver == "0010":
        c.execute(text("UPDATE alembic_version SET version_num = '0009'"))
        print("Reset alembic_version to 0009")
PY
cd "$ROOT"
make migrate
echo "Done. Current revision:"
(cd backend && .venv/bin/alembic current)