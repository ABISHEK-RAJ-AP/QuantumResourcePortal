#!/usr/bin/env bash
# Start QRP API + UI after ensuring lab deps/DB exist.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/qrp-common.sh
source "$ROOT/scripts/lib/qrp-common.sh"

cd "$ROOT"
qrp_bootstrap_path

# Always make sure the stack is ready (idempotent).
bash "$ROOT/scripts/setup-qrp.sh"

# shellcheck source=/dev/null
source "$ROOT/logs/runtime.env"

API_PORT="${QRP_API_PORT:-8000}"
UI_PORT="${QRP_UI_PORT:-5176}"
API_TARGET="${QRP_API_TARGET:-http://127.0.0.1:${API_PORT}}"
PY="$ROOT/backend/.venv/bin/python"
mkdir -p "$ROOT/logs"

if qrp_is_qrp_api "$API_PORT"; then
  qrp_log "API already on :${API_PORT}"
else
  qrp_log "Starting API :${API_PORT}"
  nohup "$PY" -m uvicorn qre.main:app --app-dir "$ROOT/backend" --host 127.0.0.1 --port "$API_PORT" \
    >"$ROOT/logs/api.log" 2>&1 &
  echo $! >"$ROOT/logs/api.pid"
  for _ in $(seq 1 40); do
    qrp_is_qrp_api "$API_PORT" && break
    sleep 0.25
  done
  qrp_is_qrp_api "$API_PORT" || qrp_die "API failed to start (see logs/api.log)"
fi

if curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null; then
  qrp_log "UI already on :${UI_PORT}"
else
  qrp_log "Starting UI :${UI_PORT} → ${API_TARGET}"
  nohup bash -lc "cd $(printf %q "$ROOT/frontend") && QRP_API_TARGET=$(printf %q "$API_TARGET") npm run dev -- --host 127.0.0.1 --port ${UI_PORT}" \
    >"$ROOT/logs/ui.log" 2>&1 &
  echo $! >"$ROOT/logs/ui.pid"
  for _ in $(seq 1 60); do
    curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null && break
    sleep 0.25
  done
fi

command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:${UI_PORT}/qrp" >/dev/null 2>&1 || true

qrp_log "Portal  http://127.0.0.1:${UI_PORT}/qrp"
qrp_log "API     http://127.0.0.1:${API_PORT}/healthz"
qrp_log "Docs    http://127.0.0.1:${API_PORT}/api/v1/docs"
qrp_log "Admin   admin / Admin-Strong-Pw-2026  (override with QRE_BOOTSTRAP_*)"
