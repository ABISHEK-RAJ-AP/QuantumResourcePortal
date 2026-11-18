#!/usr/bin/env bash
# Standalone QRP launcher (this repo root = quantum-resource-portal).
# Starts Postgres (if configured), FastAPI :8010, Vite :5176 in separate terminals when possible.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/qrp-ports.sh
source "$ROOT/scripts/lib/qrp-ports.sh"

log() { printf '\033[1;36m[qrp]\033[0m %s\n' "$*"; }
pause_fail() {
  printf '\033[1;31m[qrp]\033[0m %s\n' "$*" >&2
  read -r -p "Press Enter to close… " _
  exit 1
}

spawn_term() {
  local title="$1"
  shift
  local cmd="$*"
  local wrapped="cd $(printf %q "$ROOT"); $cmd; ec=\$?; echo; echo \"[exit \$ec]\"; read -r -p 'Press Enter to close this terminal… ' _"
  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -lc "$wrapped" &
    return 0
  fi
  if command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -lc "$wrapped" &
    return 0
  fi
  log "No GUI terminal — inline: $title"
  bash -lc "$cmd"
}

# Prefer monorepo PATH bootstrap (nvm / miniforge) when available
MONOREPO_ENV="$(cd "$ROOT/.." 2>/dev/null && pwd)/scripts/_dev-env.sh"
if [[ -f "$MONOREPO_ENV" ]]; then
  # shellcheck source=/dev/null
  source "$MONOREPO_ENV"
elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi
command -v npm >/dev/null || pause_fail "npm not found (install Node or nvm; PATH=$PATH)"

VENV="$ROOT/backend/.venv"
PY="$VENV/bin/python"
if [[ ! -x "$PY" ]]; then
  log "Creating backend venv…"
  python3 -m venv "$VENV" || pause_fail "python3-venv missing"
  "$PY" -m pip install -q -U pip
  "$PY" -m pip install -q -r backend/requirements-dev.txt
fi
[[ -f backend/.env ]] || cp backend/.env.example backend/.env

if [[ ! -d frontend/node_modules ]]; then
  log "npm ci / install frontend…"
  (cd frontend && (npm ci || npm install)) || pause_fail "frontend install failed"
fi

# Optional: alembic if DB reachable
if "$PY" -c "import asyncpg" 2>/dev/null; then
  (cd backend && ../backend/.venv/bin/alembic upgrade head) 2>/dev/null || log "migrate skipped (DB may be down — see README)"
fi

API_UP=0
UI_UP=0
curl -sf -m 1 "http://127.0.0.1:${API_PORT}/readyz" >/dev/null 2>&1 && API_UP=1 || true
curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" >/dev/null 2>&1 && UI_UP=1 || true

if [[ "$API_UP" -eq 0 ]]; then
  log "Opening terminal: QRP API :${API_PORT}"
  spawn_term "QRP API :${API_PORT}" \
    "cd backend && .venv/bin/uvicorn qre.main:app --reload --host 127.0.0.1 --port ${API_PORT}"
fi
if [[ "$UI_UP" -eq 0 ]]; then
  log "Opening terminal: QRP UI :5176"
  spawn_term "QRP UI :${UI_PORT}" \
    "cd frontend && QRP_API_TARGET=${QRP_API_TARGET} npm run dev -- --host 127.0.0.1 --port ${UI_PORT}"
fi

sleep 2
command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:${UI_PORT}/qrp" >/dev/null 2>&1 || true
log "  API    http://127.0.0.1:${API_PORT}  (docs /api/v1/docs)"
log "  Portal http://127.0.0.1:${UI_PORT}/qrp"
read -r -p "Launcher OK — Press Enter to close (servers keep running)… " _
