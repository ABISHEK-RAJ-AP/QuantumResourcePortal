#!/usr/bin/env bash
# Full lab bring-up: setup (deps/DB) then start QRP API + UI on dedicated ports.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/qrp-common.sh
source "$ROOT/scripts/lib/qrp-common.sh"

cd "$ROOT"
qrp_bootstrap_path
bash "$ROOT/scripts/setup-qrp.sh"
# shellcheck source=/dev/null
source "$ROOT/logs/runtime.env"

API_PORT="${QRP_API_PORT:-$QRP_DEFAULT_API_PORT}"
UI_PORT="${QRP_UI_PORT:-$QRP_DEFAULT_UI_PORT}"
API_TARGET="${QRP_API_TARGET:-http://127.0.0.1:${API_PORT}}"
PY="$ROOT/backend/.venv/bin/python"
HOST_BIND="${QRP_BIND:-127.0.0.1}"
mkdir -p "$ROOT/logs"

if qrp_is_qrp_api "$API_PORT"; then
  qrp_log "API already on :${API_PORT}"
else
  qrp_log "Starting API :${API_PORT}"
  nohup "$PY" -m uvicorn qre.main:app --app-dir "$ROOT/backend" --host "$HOST_BIND" --port "$API_PORT" \
    >"$ROOT/logs/api.log" 2>&1 &
  echo $! >"$ROOT/logs/api.pid"
  for _ in $(seq 1 60); do
    qrp_is_qrp_api "$API_PORT" && break
    sleep 0.25
  done
  qrp_is_qrp_api "$API_PORT" || qrp_die "API failed to start (see logs/api.log)"
fi

if curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null; then
  qrp_log "UI already on :${UI_PORT}"
else
  qrp_log "Starting UI :${UI_PORT} → ${API_TARGET}"
  nohup env PATH="$PATH" QRP_API_TARGET="$API_TARGET" \
    bash -c "cd $(printf %q "$ROOT/frontend") && npm run dev -- --host ${HOST_BIND} --port ${UI_PORT}" \
    >"$ROOT/logs/ui.log" 2>&1 &
  echo $! >"$ROOT/logs/ui.pid"
  for _ in $(seq 1 80); do
    curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null && break
    sleep 0.25
  done
fi

qrp_write_runtime_env "$ROOT" "$API_PORT" "$UI_PORT"
command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:${UI_PORT}/qrp" >/dev/null 2>&1 || true

qrp_log "Portal  http://127.0.0.1:${UI_PORT}/qrp"
qrp_log "API     http://127.0.0.1:${API_PORT}/healthz"
qrp_log "Docs    http://127.0.0.1:${API_PORT}/api/v1/docs"
qrp_log "Admin   admin / Admin-Strong-Pw-2026"
