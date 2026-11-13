#!/usr/bin/env bash
# Shared helpers for QRP setup / start scripts. Source only — do not execute.
# shellcheck shell=bash

qrp_root() {
  cd "$(dirname "${BASH_SOURCE[1]}")/.." && pwd
}

qrp_log() { printf '\033[1;36m[qrp]\033[0m %s\n' "$*"; }
qrp_warn() { printf '\033[1;33m[qrp]\033[0m %s\n' "$*" >&2; }
qrp_die() { printf '\033[1;31m[qrp]\033[0m %s\n' "$*" >&2; exit 1; }

qrp_bootstrap_path() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck source=/dev/null
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  export PATH="${HOME}/miniforge3/bin:${HOME}/.local/bin:/usr/local/bin:${PATH:-}"
}

qrp_port_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tln | grep -qE ":${port}[[:space:]]"
  else
    (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
  fi
}

qrp_is_qrp_api() {
  local port="$1"
  local body
  # QRP /readyz reports alembic "at head …"; other apps on the same ports do not.
  body="$(curl -sf -m 1 "http://127.0.0.1:${port}/readyz" 2>/dev/null || true)"
  [[ "$body" == *'"status":"ready"'* ]] && [[ "$body" == *'at head'* ]]
}

qrp_pick_api_port() {
  local preferred="${API_PORT:-8000}"
  local p
  for p in "$preferred" 8000 8001 8002 8080; do
    if qrp_is_qrp_api "$p"; then
      echo "$p"
      return 0
    fi
    if ! qrp_port_listening "$p"; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

qrp_ensure_python() {
  if command -v python3 >/dev/null 2>&1; then
    return 0
  fi
  qrp_die "python3 not found. Install Python 3.11+ and re-run."
}

qrp_ensure_node() {
  if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    return 0
  fi
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    nvm install --lts >/dev/null 2>&1 || true
    nvm use --lts >/dev/null 2>&1 || true
  fi
  command -v npm >/dev/null 2>&1 || qrp_die "npm not found. Install Node.js 20+ (or nvm) and re-run."
}

qrp_ensure_postgres_bins() {
  if command -v initdb >/dev/null 2>&1 && command -v postgres >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
    return 0
  fi
  qrp_die "PostgreSQL client/server tools not found (initdb/postgres/psql). Install PostgreSQL 16+ or conda/miniforge postgresql."
}

# Start a private cluster under $ROOT/.pgdata when nothing answers on PGPORT.
qrp_ensure_lab_postgres() {
  local root="$1"
  local pgport="${QRP_PGPORT:-}"
  local pgdata="${QRP_PGDATA:-$root/.pgdata}"
  local user="${QRP_PGUSER:-qre_app}"
  local pass="${QRP_PGPASSWORD:-qre_dev_password}"
  local host="127.0.0.1"

  if [[ -z "$pgport" ]]; then
    if pg_isready -h "$host" -p 5432 >/dev/null 2>&1; then
      pgport=5432
    else
      pgport=5433
    fi
  fi
  export QRP_PGPORT="$pgport"
  export QRP_PGDATA="$pgdata"

  if pg_isready -h "$host" -p "$pgport" >/dev/null 2>&1; then
    qrp_log "Postgres ready on ${host}:${pgport}"
  else
    qrp_ensure_postgres_bins
    mkdir -p "$pgdata"
    if [[ ! -f "$pgdata/PG_VERSION" ]]; then
      qrp_log "Initialising lab Postgres in ${pgdata}"
      initdb -D "$pgdata" --auth-local=trust --auth-host=trust -U "$user" >/dev/null
    fi
    qrp_log "Starting lab Postgres on ${host}:${pgport}"
    postgres -D "$pgdata" -p "$pgport" -k /tmp -h "$host" >>"$pgdata/postgres.log" 2>&1 &
    echo $! >"$pgdata/postmaster.agent.pid"
    local i
    for i in $(seq 1 40); do
      pg_isready -h "$host" -p "$pgport" >/dev/null 2>&1 && break
      sleep 0.25
    done
    pg_isready -h "$host" -p "$pgport" >/dev/null 2>&1 || qrp_die "Postgres failed to start (see ${pgdata}/postgres.log)"
  fi

  # Ensure role + databases exist (lab trust / password auth).
  if command -v createuser >/dev/null 2>&1; then
    createuser -h "$host" -p "$pgport" -U "$user" "$user" 2>/dev/null || true
  fi
  PGPASSWORD="$pass" psql -h "$host" -p "$pgport" -U "$user" -d postgres -v ON_ERROR_STOP=0 <<SQL >/dev/null 2>&1 || true
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN
    CREATE ROLE ${user} LOGIN PASSWORD '${pass}';
  END IF;
END
\$\$;
SQL
  createdb -h "$host" -p "$pgport" -U "$user" qre 2>/dev/null || true
  createdb -h "$host" -p "$pgport" -U "$user" qre_test 2>/dev/null || true

  export QRP_DATABASE_URL="postgresql+asyncpg://${user}:${pass}@${host}:${pgport}/qre"
  export QRP_TEST_DATABASE_URL="postgresql+asyncpg://${user}:${pass}@${host}:${pgport}/qre_test"
}

qrp_write_env() {
  local root="$1"
  local envf="$root/backend/.env"
  if [[ ! -f "$envf" ]]; then
    cp "$root/backend/.env.example" "$envf"
  fi
  if [[ -n "${QRP_DATABASE_URL:-}" ]]; then
    # Rewrite DSNs in place without depending on sed -i portability.
    python3 - "$envf" <<'PY'
import re, sys
path = sys.argv[1]
import os
text = open(path).read()
db = os.environ["QRP_DATABASE_URL"]
tdb = os.environ["QRP_TEST_DATABASE_URL"]
text = re.sub(r"(?m)^QRE_DATABASE_URL=.*$", f"QRE_DATABASE_URL={db}", text)
text = re.sub(r"(?m)^QRE_TEST_DATABASE_URL=.*$", f"QRE_TEST_DATABASE_URL={tdb}", text)
open(path, "w").write(text)
PY
  fi
}

qrp_ensure_backend_venv() {
  local root="$1"
  local venv="$root/backend/.venv"
  local py="$venv/bin/python"
  if [[ ! -x "$py" ]]; then
    qrp_log "Creating backend venv"
    python3 -m venv "$venv" || qrp_die "python3 -m venv failed (install python3-venv)"
    "$py" -m pip install -q -U pip
    "$py" -m pip install -q -r "$root/backend/requirements-dev.txt"
  fi
}

qrp_ensure_frontend() {
  local root="$1"
  if [[ ! -d "$root/frontend/node_modules" ]]; then
    qrp_log "Installing frontend dependencies"
    (cd "$root/frontend" && (npm ci || npm install)) || qrp_die "npm install failed"
  fi
}

qrp_migrate() {
  local root="$1"
  qrp_log "Applying migrations"
  (cd "$root/backend" && .venv/bin/alembic upgrade head) || qrp_die "alembic upgrade failed"
}

qrp_bootstrap_lab_admin() {
  local root="$1"
  local user="${QRE_BOOTSTRAP_USERNAME:-admin}"
  local pass="${QRE_BOOTSTRAP_PASSWORD:-Admin-Strong-Pw-2026}"
  local tenant="${QRE_BOOTSTRAP_TENANT:-CDAC}"
  export QRE_BOOTSTRAP_PASSWORD="$pass"
  qrp_log "Ensuring lab PLATFORM_ADMIN (${user})"
  (cd "$root/backend" && QRE_BOOTSTRAP_PASSWORD="$pass" .venv/bin/python -m qre bootstrap \
    --tenant-code "$tenant" \
    --tenant-name "C-DAC" \
    --admin-username "$user" \
    --email "${user}@example.local") >/dev/null 2>&1 \
    && qrp_log "Bootstrap complete — sign in as ${user}" \
    || qrp_log "Bootstrap skipped (tenant/admin already present)"
}
