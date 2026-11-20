# shellcheck shell=bash
# Shared VM / lab bootstrap for Quantum Resource Portal (QRP only — not Q-TeleScope).
# Redis/Valkey for cache + CAPTCHA; signed-in sessions in PostgreSQL. API :8010 + Vite :5176 (not TeleScope :8000).

vm_log() { printf '\033[1;36m[qrp-vm]\033[0m %s\n' "$*"; }
vm_die() { printf '\033[1;31m[qrp-vm]\033[0m %s\n' "$*" >&2; exit 1; }

vm_bootstrap_path() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [[ -s "$NVM_DIR/nvm.sh" ]] && # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
  export PATH="$HOME/miniforge3/bin:$HOME/.local/bin:/usr/local/bin:${PATH:-}"
}

vm_ensure_venv() {
  local root="$1"
  local venv="$root/backend/.venv"
  local py="$venv/bin/python"
  if [[ -x "$py" ]] && "$py" -c "import uvicorn" 2>/dev/null; then
    return 0
  fi
  vm_log "Backend venv + dependencies (python3-venv required on Debian: apt install python3-venv)"
  if [[ ! -x "$py" ]]; then
    if ! python3 -m venv "$venv" 2>/dev/null; then
      vm_die "Could not create venv — install: sudo apt install python3-venv"
    fi
  fi
  "$py" -m pip install -q -U pip
  "$py" -m pip install -q -r "$root/backend/requirements-dev.txt"
}

vm_ensure_env_files() {
  local root="$1"
  local file pair k
  [[ -f "$root/backend/.env" ]] || cp "$root/backend/.env.example" "$root/backend/.env"
  # DB port/host: vm-ensure-postgres.sh syncs QRE_* URLs (default :5434, not Q-TeleScope :5433).
  [[ -f "$root/frontend/.env.local" ]] || cp "$root/frontend/.env.example" "$root/frontend/.env.local"
  for pair in 'QRE_ENV=lab' 'QRE_CAPTCHA_ENABLED=true'; do
    k="${pair%%=*}"
    if grep -q "^${k}=" "$root/backend/.env" 2>/dev/null; then
      sed -i "s/^${k}=.*/${pair}/" "$root/backend/.env"
    else
      echo "$pair" >>"$root/backend/.env"
    fi
  done
  for pair in 'VITE_QRE_ENV=lab' 'VITE_QRE_CAPTCHA=0'; do
    k="${pair%%=*}"
    if grep -q "^${k}=" "$root/frontend/.env.local" 2>/dev/null; then
      sed -i "s/^${k}=.*/${pair}/" "$root/frontend/.env.local"
    else
      echo "$pair" >>"$root/frontend/.env.local"
    fi
  done
  # shellcheck source=scripts/lib/qrp-ports.sh
  local ports_sh="$root/scripts/lib/qrp-ports.sh"
  if [[ -f "$ports_sh" ]]; then
    # shellcheck disable=SC1090
    source "$ports_sh"
  fi
  local target="${QRP_API_TARGET:-http://127.0.0.1:8010}"
  if grep -q '^QRP_API_TARGET=' "$root/frontend/.env.local" 2>/dev/null; then
    sed -i "s|^QRP_API_TARGET=.*|QRP_API_TARGET=${target}|" "$root/frontend/.env.local"
  else
    echo "QRP_API_TARGET=${target}" >>"$root/frontend/.env.local"
  fi
  if grep -q '^QRE_PUBLIC_BASE_URL=' "$root/backend/.env" 2>/dev/null; then
    sed -i "s|^QRE_PUBLIC_BASE_URL=.*|QRE_PUBLIC_BASE_URL=http://localhost:${UI_PORT:-5176}|" "$root/backend/.env"
  fi
}

vm_postgres_hint() {
  vm_log "PostgreSQL: ensure role/database exist (once per VM):"
  echo "  sudo -u postgres psql -c \"CREATE ROLE qre_app WITH LOGIN PASSWORD 'qre_dev_password';\" 2>/dev/null || true"
  echo "  sudo -u postgres psql -c \"CREATE DATABASE qre OWNER qre_app;\" 2>/dev/null || true"
  echo "  sudo -u postgres psql -c \"CREATE DATABASE qre_test OWNER qre_app;\" 2>/dev/null || true"
}

vm_postgres_ready() {
  command -v pg_isready >/dev/null 2>&1 && pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null
}

vm_kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti:"$port" 2>/dev/null || true)"
    [[ -n "$pids" ]] && kill $pids 2>/dev/null || true
  fi
  sleep 1
}

# True when this port is the QRP gateway (not TeleScope :8000 or a dead listener).
vm_qrp_api_ok() {
  local port="${1:-8010}"
  local caps body
  curl -sf -m 3 "http://127.0.0.1:${port}/healthz" >/dev/null 2>&1 || return 1
  body="$(curl -sf -m 3 "http://127.0.0.1:${port}/readyz" 2>/dev/null)" || return 1
  echo "$body" | grep -q '"migrations"' || return 1
  caps="$(curl -sf -m 3 "http://127.0.0.1:${port}/api/v1/auth/capabilities" 2>/dev/null)" || return 1
  echo "$caps" | grep -q '"cache"' || return 1
  curl -sf -m 3 "http://127.0.0.1:${port}/api/v1/auth/session" 2>/dev/null | grep -q '"authenticated"' || return 1
  return 0
}

vm_stop_logged_api() {
  local root="$1"
  [[ -f "$root/logs/api.pid" ]] && kill "$(cat "$root/logs/api.pid")" 2>/dev/null || true
  rm -f "$root/logs/api.pid"
}

vm_start_api() {
  local root="$1"
  local port="${2:-8010}"
  local py="$root/backend/.venv/bin/python"
  vm_stop_logged_api "$root"
  vm_kill_port "$port"
  vm_log "Starting QRP API on :${port} (this repo's gateway — not Q-TeleScope)"
  nohup "$py" -m uvicorn qre.main:app --app-dir "$root/backend" --host 0.0.0.0 --port "$port" \
    >"$root/logs/api.log" 2>&1 &
  echo $! >"$root/logs/api.pid"
  local i=0
  while [[ $i -lt 25 ]]; do
    if vm_qrp_api_ok "$port"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  vm_die "QRP API failed to become ready — tail -50 $root/logs/api.log (Postgres? make migrate?)"
}

vm_stop_logged_ui() {
  local root="$1"
  [[ -f "$root/logs/ui.pid" ]] && kill "$(cat "$root/logs/ui.pid")" 2>/dev/null || true
  rm -f "$root/logs/ui.pid"
}

vm_start_ui() {
  local root="$1"
  local port="${2:-5176}"
  vm_stop_logged_ui "$root"
  vm_kill_port "$port"
  local api_port="${3:-8010}"
  vm_log "Starting Vite on :${port} (proxies /api → :${api_port})"
  nohup bash -lc "cd $(printf %q "$root/frontend") && QRP_API_TARGET=http://127.0.0.1:${api_port} npm run dev -- --host 0.0.0.0 --port $port" \
    >"$root/logs/ui.log" 2>&1 &
  echo $! >"$root/logs/ui.pid"
  sleep 2
}

vm_proxy_ok() {
  local ui_port="${1:-5176}"
  curl -sf -m 4 "http://127.0.0.1:${ui_port}/api/v1/auth/session" 2>/dev/null | grep -q '"authenticated"' || return 1
  curl -sf -m 4 "http://127.0.0.1:${ui_port}/api/v1/auth/captcha" 2>/dev/null | grep -q '"captcha_id"' || return 1
  return 0
}