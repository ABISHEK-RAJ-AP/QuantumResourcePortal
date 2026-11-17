#!/usr/bin/env bash
# VM: Quantum Resource Portal only (this repo). Starts QRE API :8000 + Vite :5176.
# Q-TeleScope is a separate application; do not point this portal at TeleScope.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '\033[1;36m[qrp-vm]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[qrp-vm]\033[0m %s\n' "$*" >&2; exit 1; }

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/miniforge3/bin:$HOME/.local/bin:/usr/local/bin:${PATH:-}"

if command -v git >/dev/null; then
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
  CUR="$(git branch --show-current 2>/dev/null || true)"
    if [[ "$CUR" == "main" ]]; then
      git pull --ff-only origin main || log "git pull skipped (diverged — run: bash scripts/vm-pull-main.sh)"
    else
      log "Not on main ($CUR) — skipping pull (run: bash scripts/vm-pull-main.sh for origin/main)"
    fi
  else
    git fetch origin 2>/dev/null || log "git fetch skipped"
  fi
fi

API_PORT="${API_PORT:-8000}"
UI_PORT="${UI_PORT:-5176}"
mkdir -p "$ROOT/logs"

VENV="$ROOT/backend/.venv"
PY="$VENV/bin/python"
if [[ ! -x "$PY" ]]; then
  log "Backend setup"
  make setup-backend
fi

[[ -f "$ROOT/backend/.env" ]] || cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
[[ -f "$ROOT/frontend/.env.local" ]] || cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env.local"
if [[ -f "$ROOT/backend/.env" ]] && ! grep -q '^QRE_CAPTCHA_ENABLED=true' "$ROOT/backend/.env" 2>/dev/null; then
  if grep -q '^QRE_CAPTCHA_ENABLED=' "$ROOT/backend/.env"; then
    sed -i 's/^QRE_CAPTCHA_ENABLED=.*/QRE_CAPTCHA_ENABLED=true/' "$ROOT/backend/.env"
  else
    echo 'QRE_CAPTCHA_ENABLED=true' >>"$ROOT/backend/.env"
  fi
  if [[ -f "$ROOT/logs/api.pid" ]]; then
    kill "$(cat "$ROOT/logs/api.pid")" 2>/dev/null || true
    rm -f "$ROOT/logs/api.pid"
    log "Restarting API so captcha picks up QRE_CAPTCHA_ENABLED=true"
  fi
fi
log "Database migrate"
make migrate || die "alembic failed — create Postgres database qre per README"

if ! curl -sf -m 1 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1; then
  log "Start QRE API :${API_PORT}"
  nohup "$PY" -m uvicorn qre.main:app --app-dir "$ROOT/backend" --host 0.0.0.0 --port "$API_PORT" \
    >"$ROOT/logs/api.log" 2>&1 &
  echo $! >"$ROOT/logs/api.pid"
else
  log "API already on :${API_PORT}"
fi

command -v npm >/dev/null || die "npm missing"
if [[ ! -d frontend/node_modules ]]; then
  log "npm install"
  (cd frontend && npm install)
fi

if curl -sf -m 1 "http://127.0.0.1:${UI_PORT}/" >/dev/null 2>&1; then
  log "UI already on :${UI_PORT}"
else
  log "Start Vite :${UI_PORT}"
  nohup bash -lc "cd $(printf %q "$ROOT/frontend") && npm run dev -- --host 0.0.0.0 --port $UI_PORT" \
    >"$ROOT/logs/ui.log" 2>&1 &
  echo $! >"$ROOT/logs/ui.pid"
fi

log "Portal  http://0.0.0.0:${UI_PORT}/qrp"
log "API     http://0.0.0.0:${API_PORT}/healthz"
log "Admin   use seeded lab principal after migrate (see docs/RBAC_DELIVERY.md)"
echo
echo "Manual:"
echo "  cd $ROOT && make setup && make migrate"
echo "  make dev-api    # terminal 1"
echo "  make dev-web    # terminal 2 (or port 5176: cd frontend && npm run dev -- --host 0.0.0.0 --port 5176)"
