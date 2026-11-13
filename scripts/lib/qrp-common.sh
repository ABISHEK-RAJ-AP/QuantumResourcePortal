#!/usr/bin/env bash
# Shared helpers for QRP setup / start scripts. Source only — do not execute.
# shellcheck shell=bash

qrp_log() { printf '\033[1;36m[qrp]\033[0m %s\n' "$*"; }
qrp_warn() { printf '\033[1;33m[qrp]\033[0m %s\n' "$*" >&2; }
qrp_die() { printf '\033[1;31m[qrp]\033[0m %s\n' "$*" >&2; exit 1; }

# QRP defaults stay off common neighbour ports (:8000 / :5173 / :5432).
QRP_DEFAULT_API_PORT="${QRP_DEFAULT_API_PORT:-8088}"
QRP_DEFAULT_UI_PORT="${QRP_DEFAULT_UI_PORT:-5176}"
QRP_DEFAULT_PGPORT="${QRP_DEFAULT_PGPORT:-5433}"

qrp_bootstrap_path() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck source=/dev/null
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  # Prefer user-local Postgres/conda bins; also Debian cluster bins.
  local pgbin
  for pgbin in /usr/lib/postgresql/*/bin; do
    [[ -d "$pgbin" ]] && export PATH="${pgbin}:${PATH}"
  done
  export PATH="${HOME}/miniforge3/bin:${HOME}/mambaforge/bin:${HOME}/.local/bin:/usr/local/bin:${PATH:-}"
}

qrp_have_cmd() { command -v "$1" >/dev/null 2>&1; }

qrp_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif qrp_have_cmd sudo && sudo -n true 2>/dev/null; then
    sudo "$@"
  elif qrp_have_cmd sudo; then
    qrp_log "Need sudo for: $*"
    sudo "$@"
  else
    return 1
  fi
}

qrp_apt_install() {
  qrp_have_cmd apt-get || return 1
  qrp_log "apt install: $*"
  qrp_sudo apt-get update -y >/dev/null \
    && qrp_sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
}

qrp_conda_bin() {
  if qrp_have_cmd conda; then
    command -v conda
    return 0
  fi
  for c in "$HOME/miniforge3/bin/conda" "$HOME/mambaforge/bin/conda" "$HOME/anaconda3/bin/conda"; do
    [[ -x "$c" ]] && { echo "$c"; return 0; }
  done
  return 1
}

qrp_port_listening() {
  local port="$1"
  if qrp_have_cmd ss; then
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
  local preferred="${API_PORT:-$QRP_DEFAULT_API_PORT}"
  local p
  for p in "$preferred" 8088 8001 8002 8080 8010; do
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

qrp_pick_ui_port() {
  local preferred="${UI_PORT:-$QRP_DEFAULT_UI_PORT}"
  local p
  for p in "$preferred" 5176 5177 5178 4173; do
    if ! qrp_port_listening "$p"; then
      echo "$p"
      return 0
    fi
    # Already our Vite? treat as ok to reuse.
    if curl -sf -m 1 -o /dev/null "http://127.0.0.1:${p}/" 2>/dev/null; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

qrp_ensure_python() {
  if qrp_have_cmd python3; then
    return 0
  fi
  qrp_log "Installing python3…"
  qrp_apt_install python3 python3-venv python3-pip || qrp_die "python3 missing and apt install failed"
  qrp_have_cmd python3 || qrp_die "python3 not found after install"
}

qrp_ensure_venv_module() {
  if python3 -m venv --help >/dev/null 2>&1; then
    return 0
  fi
  qrp_log "Installing python3-venv…"
  qrp_apt_install python3-venv || qrp_die "python3-venv missing"
}

qrp_ensure_curl() {
  qrp_have_cmd curl && return 0
  qrp_apt_install curl || qrp_die "curl missing"
}

qrp_ensure_node() {
  qrp_bootstrap_path
  if qrp_have_cmd npm && qrp_have_cmd node; then
    return 0
  fi
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    qrp_log "Installing nvm…"
    qrp_ensure_curl
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  # shellcheck source=/dev/null
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
  qrp_log "Installing Node LTS via nvm…"
  nvm install --lts
  nvm use --lts
  qrp_have_cmd npm || qrp_die "npm still missing after nvm install"
}

qrp_postgres_bins_ok() {
  qrp_have_cmd initdb && qrp_have_cmd postgres && qrp_have_cmd psql && qrp_have_cmd pg_isready
}

qrp_refresh_postgres_path() {
  local pgbin
  for pgbin in /usr/lib/postgresql/*/bin; do
    [[ -d "$pgbin" ]] && export PATH="${pgbin}:${PATH}"
  done
  export PATH="${HOME}/miniforge3/bin:${HOME}/mambaforge/bin:${PATH}"
}

# Install PostgreSQL server+client tools if missing (apt, else conda/miniforge).
qrp_ensure_postgres_bins() {
  qrp_refresh_postgres_path
  if qrp_postgres_bins_ok; then
    return 0
  fi

  qrp_log "PostgreSQL tools missing — installing…"

  if qrp_apt_install postgresql postgresql-contrib postgresql-client; then
    qrp_refresh_postgres_path
    if qrp_postgres_bins_ok; then
      qrp_log "PostgreSQL installed via apt"
      return 0
    fi
  fi

  local conda
  if conda="$(qrp_conda_bin)"; then
    qrp_log "Installing postgresql via conda ($conda)…"
    # shellcheck source=/dev/null
    eval "$("$conda" shell.bash hook)"
    conda install -y -c conda-forge postgresql=16 || conda install -y -c conda-forge postgresql
    qrp_refresh_postgres_path
    if qrp_postgres_bins_ok; then
      qrp_log "PostgreSQL installed via conda"
      return 0
    fi
  fi

  # Last resort: install miniforge then postgresql (user-space, no root).
  if [[ ! -x "$HOME/miniforge3/bin/conda" ]]; then
    qrp_log "Installing Miniforge (user-space)…"
    qrp_ensure_curl
    local installer="/tmp/Miniforge3-Linux-x86_64.sh"
    curl -fsSL -o "$installer" \
      "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh"
    bash "$installer" -b -p "$HOME/miniforge3"
  fi
  if [[ -x "$HOME/miniforge3/bin/conda" ]]; then
    # shellcheck source=/dev/null
    eval "$("$HOME/miniforge3/bin/conda" shell.bash hook)"
    conda install -y -c conda-forge postgresql=16 || conda install -y -c conda-forge postgresql
    qrp_refresh_postgres_path
  fi

  qrp_postgres_bins_ok || qrp_die "Could not install initdb/postgres/psql. Fix network/sudo and re-run."
}

# Always prefer QRP's private cluster on :5433 (override with QRP_PGPORT).
qrp_ensure_lab_postgres() {
  local root="$1"
  local pgport="${QRP_PGPORT:-$QRP_DEFAULT_PGPORT}"
  local pgdata="${QRP_PGDATA:-$root/.pgdata}"
  local user="${QRP_PGUSER:-qre_app}"
  local pass="${QRP_PGPASSWORD:-qre_dev_password}"
  local host="127.0.0.1"

  qrp_ensure_postgres_bins

  export QRP_PGPORT="$pgport"
  export QRP_PGDATA="$pgdata"

  if pg_isready -h "$host" -p "$pgport" >/dev/null 2>&1; then
    qrp_log "Postgres ready on ${host}:${pgport}"
  else
    mkdir -p "$pgdata"
    if [[ ! -f "$pgdata/PG_VERSION" ]]; then
      qrp_log "Initialising lab Postgres in ${pgdata}"
      initdb -D "$pgdata" --auth-local=trust --auth-host=trust -U "$user" >/dev/null
    fi
    qrp_log "Starting lab Postgres on ${host}:${pgport}"
    postgres -D "$pgdata" -p "$pgport" -k /tmp -h "$host" >>"$pgdata/postgres.log" 2>&1 &
    echo $! >"$pgdata/postmaster.agent.pid"
    local i
    for i in $(seq 1 60); do
      pg_isready -h "$host" -p "$pgport" >/dev/null 2>&1 && break
      sleep 0.25
    done
    pg_isready -h "$host" -p "$pgport" >/dev/null 2>&1 \
      || qrp_die "Postgres failed to start (see ${pgdata}/postgres.log)"
  fi

  if qrp_have_cmd createuser; then
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
    python3 - "$envf" <<'PY'
import os, re, sys
path = sys.argv[1]
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
  qrp_ensure_venv_module
  if [[ ! -x "$py" ]]; then
    qrp_log "Creating backend venv"
    python3 -m venv "$venv" || qrp_die "python3 -m venv failed"
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

qrp_write_runtime_env() {
  local root="$1"
  local api_port="$2"
  local ui_port="$3"
  mkdir -p "$root/logs"
  cat >"$root/logs/runtime.env" <<EOF
QRP_API_PORT=${api_port}
QRP_UI_PORT=${ui_port}
QRP_API_TARGET=http://127.0.0.1:${api_port}
QRP_PGPORT=${QRP_PGPORT:-}
QRP_DATABASE_URL=${QRP_DATABASE_URL:-}
EOF
}
