#!/usr/bin/env bash
# VM: QRP frontend :5176. API is TeleScope on :8000 (this portal proxies /api).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '\033[1;36m[qrp-vm]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[qrp-vm]\033[0m %s\n' "$*" >&2; exit 1; }

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/miniforge3/bin:$HOME/.local/bin:/usr/local/bin:${PATH:-}"

command -v git >/dev/null && git pull --ff-only || log "git pull skipped"
command -v npm >/dev/null || die "npm missing"

if [[ ! -d frontend/node_modules ]]; then
  log "npm install"
  (cd frontend && npm install)
fi

TELESCOPE_ROOT="${TELESCOPE_ROOT:-}"
if [[ -z "$TELESCOPE_ROOT" && -d "$ROOT/../Quantum_Monitoring-main" ]]; then
  TELESCOPE_ROOT="$(cd "$ROOT/../Quantum_Monitoring-main" && pwd)"
fi
if [[ -z "$TELESCOPE_ROOT" && -f "$ROOT/../app/main.py" ]]; then
  TELESCOPE_ROOT="$(cd "$ROOT/.." && pwd)"
fi

UI_PORT="${UI_PORT:-5176}"
API_PORT="${API_PORT:-8000}"
mkdir -p "$ROOT/logs"

if [[ -n "$TELESCOPE_ROOT" && -f "$TELESCOPE_ROOT/app/main.py" ]]; then
  if ! curl -sf -m 1 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1; then
    log "Start TeleScope API from $TELESCOPE_ROOT"
    (
      cd "$TELESCOPE_ROOT"
      export PYTHONPATH="$TELESCOPE_ROOT"
      export PATH="$HOME/miniforge3/bin:${PATH:-}"
      nohup python -m uvicorn app.main:app --host 0.0.0.0 --port "$API_PORT" >"$ROOT/logs/api.log" 2>&1 &
      echo $! >"$ROOT/logs/api.pid"
    )
  else
    log "API already on :${API_PORT}"
  fi
else
  log "No TeleScope tree. Set TELESCOPE_ROOT or start API yourself on :${API_PORT}"
fi

if curl -sf -m 1 "http://127.0.0.1:${UI_PORT}/" >/dev/null 2>&1; then
  log "UI already on :${UI_PORT}"
else
  log "Start Vite :${UI_PORT}"
  nohup bash -lc "cd $(printf %q "$ROOT/frontend") && npm run dev -- --host 0.0.0.0 --port $UI_PORT" >"$ROOT/logs/ui.log" 2>&1 &
  echo $! >"$ROOT/logs/ui.pid"
fi

log "Portal  http://0.0.0.0:${UI_PORT}/qrp"
log "Login   admin / quantum2026 (lab; API must be TeleScope)"
echo
echo "Manual:"
echo "  export TELESCOPE_ROOT=/path/to/QTelescope"
echo "  bash scripts/vm-setup.sh"
echo "  # or:"
echo "  cd frontend && npm install && npm run dev -- --host 0.0.0.0 --port 5176"
