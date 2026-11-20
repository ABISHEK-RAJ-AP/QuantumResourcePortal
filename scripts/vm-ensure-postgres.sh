#!/usr/bin/env bash
# Ensure PostgreSQL for QRP migrate — dedicated port (default :5434), independent of Q-TeleScope.
# shellcheck shell=bash
set -euo pipefail

QRP_PG_USER="${QRP_PG_USER:-qre_app}"
QRP_PG_PASSWORD="${QRP_PG_PASSWORD:-qre_dev_password}"
QRP_PG_DB="${QRP_PG_DB:-qre}"
QRP_PG_TEST_DB="${QRP_PG_TEST_DB:-qre_test}"

vm_ensure_postgres_log() { printf '\033[1;36m[qrp-pg]\033[0m %s\n' "$*"; }

_qrp_pg_listening() {
  local host="$1" port="$2"
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h "$host" -p "$port" -q 2>/dev/null
    return
  fi
  command -v ss >/dev/null 2>&1 && ss -lnt 2>/dev/null | grep -qE ":${port}[[:space:]]"
}

_qrp_auth_check() {
  local host="$1" port="$2"
  if ! command -v psql >/dev/null 2>&1; then
    return 0
  fi
  PGPASSWORD="$QRP_PG_PASSWORD" psql -h "$host" -p "$port" -U "$QRP_PG_USER" -d "$QRP_PG_DB" -c "SELECT 1" >/dev/null 2>&1
}

_qrp_docker() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  elif sudo -n docker info >/dev/null 2>&1; then
    sudo -n docker "$@"
  else
    return 1
  fi
}

_qrp_compose_up() {
  local root="$1"
  local composef="$root/docker-compose.qrp-db.yml"
  [[ -f "$composef" ]] || return 1
  export QRP_PG_PORT
  if _qrp_docker compose version >/dev/null 2>&1; then
    _qrp_docker compose -f "$composef" up -d
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$composef" up -d
    return 0
  fi
  return 1
}

_qrp_ensure_test_db_docker() {
  local cname="${QRP_PG_CONTAINER:-qrp-postgres-lab}"
  _qrp_docker exec "$cname" psql -U "$QRP_PG_USER" -d postgres -v ON_ERROR_STOP=1 -tc \
    "SELECT 1 FROM pg_database WHERE datname='${QRP_PG_TEST_DB}'" 2>/dev/null | grep -q 1 && return 0
  _qrp_docker exec "$cname" psql -U "$QRP_PG_USER" -d postgres -v ON_ERROR_STOP=1 -c \
    "CREATE DATABASE ${QRP_PG_TEST_DB} OWNER ${QRP_PG_USER};" >/dev/null 2>&1 || true
}

_qrp_try_system_postgres() {
  local port="$1"
  [[ "$port" == "5432" ]] || return 1
  if command -v systemctl >/dev/null 2>&1; then
    sudo -n systemctl start postgresql 2>/dev/null || systemctl start postgresql 2>/dev/null || true
    sleep 2
  fi
  if ! _qrp_pg_listening "127.0.0.1" 5432; then
    return 1
  fi
  if sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null 2>&1; then
    sudo -n -u postgres psql -v ON_ERROR_STOP=1 <<SQL || return 1
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${QRP_PG_USER}') THEN
    CREATE ROLE ${QRP_PG_USER} WITH LOGIN PASSWORD '${QRP_PG_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${QRP_PG_DB} OWNER ${QRP_PG_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${QRP_PG_DB}')\\gexec
SELECT 'CREATE DATABASE ${QRP_PG_TEST_DB} OWNER ${QRP_PG_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${QRP_PG_TEST_DB}')\\gexec
SQL
    return 0
  fi
  return 1
}

# Point backend/.env at QRP's DB port (never Q-TeleScope :5433 unless QRP_PG_PORT overridden).
qrp_sync_env_db_urls() {
  local root="$1"
  local envf="$root/backend/.env"
  # shellcheck source=scripts/lib/qrp-ports.sh
  source "$root/scripts/lib/qrp-ports.sh"

  [[ -f "$envf" ]] || cp "$root/backend/.env.example" "$envf"

  local had_telescope=0
  if grep -E 'QRE_(TEST_)?DATABASE_URL=.*:(5432|5433)/' "$envf" 2>/dev/null; then
    had_telescope=1
  fi

  local base="postgresql+asyncpg://${QRP_PG_USER}:${QRP_PG_PASSWORD}@${QRP_PG_HOST}:${QRP_PG_PORT}"
  sed -i 's|@localhost:|@127.0.0.1:|g' "$envf" 2>/dev/null || true

  if grep -q '^QRE_DATABASE_URL=' "$envf"; then
    sed -i "s|^QRE_DATABASE_URL=.*|QRE_DATABASE_URL=${base}/${QRP_PG_DB}|" "$envf"
  else
    echo "QRE_DATABASE_URL=${base}/${QRP_PG_DB}" >>"$envf"
  fi
  if grep -q '^QRE_TEST_DATABASE_URL=' "$envf"; then
    sed -i "s|^QRE_TEST_DATABASE_URL=.*|QRE_TEST_DATABASE_URL=${base}/${QRP_PG_TEST_DB}|" "$envf"
  else
    echo "QRE_TEST_DATABASE_URL=${base}/${QRP_PG_TEST_DB}" >>"$envf"
  fi

  if [[ "$had_telescope" == 1 ]]; then
    vm_ensure_postgres_log "Rewrote QRE_* URLs → :${QRP_PG_PORT} (Q-TeleScope often uses :5432/:${QRP_TELESCOPE_PG_PORT} — untouched)"
  else
    vm_ensure_postgres_log "QRE_* URLs → ${QRP_PG_HOST}:${QRP_PG_PORT}"
  fi
}

ensure_qrp_postgres() {
  local root="${1:?}"
  # shellcheck source=scripts/lib/qrp-ports.sh
  source "$root/scripts/lib/qrp-ports.sh"
  qrp_sync_env_db_urls "$root"

  if _qrp_pg_listening "$QRP_PG_HOST" "$QRP_PG_PORT" && _qrp_auth_check "$QRP_PG_HOST" "$QRP_PG_PORT"; then
    _qrp_ensure_test_db_docker 2>/dev/null || true
    vm_ensure_postgres_log "Ready — ${QRP_PG_USER}@${QRP_PG_HOST}:${QRP_PG_PORT}/${QRP_PG_DB}"
    return 0
  fi

  vm_ensure_postgres_log "Starting QRP Postgres on :${QRP_PG_PORT} (docker-compose.qrp-db.yml)…"
  if _qrp_compose_up "$root"; then
    for _ in $(seq 1 45); do
      if _qrp_pg_listening "$QRP_PG_HOST" "$QRP_PG_PORT" && _qrp_auth_check "$QRP_PG_HOST" "$QRP_PG_PORT"; then
        _qrp_ensure_test_db_docker
        vm_ensure_postgres_log "Docker Postgres ready on :${QRP_PG_PORT}"
        return 0
      fi
      sleep 1
    done
    vm_ensure_postgres_log "WARN: container started but :${QRP_PG_PORT} not accepting connections"
  else
    vm_ensure_postgres_log "Docker unavailable — trying system Postgres on :5432 (optional QRP_USE_SYSTEM_PG=1)"
  fi

  if [[ "${QRP_USE_SYSTEM_PG:-}" == "1" ]] && _qrp_try_system_postgres 5432; then
    QRP_PG_PORT=5432
    export QRP_PG_PORT
    qrp_sync_env_db_urls "$root"
    if _qrp_auth_check "$QRP_PG_HOST" "$QRP_PG_PORT"; then
      vm_ensure_postgres_log "Using system Postgres on :5432 (separate DB names qre / qre_test)"
      return 0
    fi
  fi

  vm_ensure_postgres_log "QRP database not ready."
  cat <<HINT
  Q-TeleScope Postgres (e.g. :${QRP_TELESCOPE_PG_PORT}) is separate — QRP uses :${QRP_PG_PORT} by default.

  Quick fix on this VM:
    cd ~/QuantumResourcePortal
    bash scripts/vm-ensure-postgres.sh    # starts docker qrp-postgres-lab on :5434, fixes backend/.env
    make migrate

  Manual:
    docker compose -f docker-compose.qrp-db.yml up -d
    # backend/.env should contain:
    # QRE_DATABASE_URL=postgresql+asyncpg://qre_app:qre_dev_password@127.0.0.1:${QRP_PG_PORT:-5434}/qre
HINT
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  ensure_qrp_postgres "$ROOT"
fi