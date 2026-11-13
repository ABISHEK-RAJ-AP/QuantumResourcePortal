#!/usr/bin/env bash
# VM: pull (optional), auto-install deps/Postgres, migrate, start QRP on dedicated ports.
# Defaults: API :8088, UI :5176, Postgres :5433 (override with API_PORT / UI_PORT / QRP_PGPORT).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/qrp-common.sh
source "$ROOT/scripts/lib/qrp-common.sh"

cd "$ROOT"
qrp_bootstrap_path

if [[ "${QRP_SKIP_PULL:-0}" != "1" ]] && command -v git >/dev/null; then
  git pull --ff-only || qrp_log "git pull skipped"
fi

export QRP_BIND="${QRP_BIND:-0.0.0.0}"
# Prefer explicit env, else QRP defaults (not :8000).
export API_PORT="${API_PORT:-$QRP_DEFAULT_API_PORT}"
export UI_PORT="${UI_PORT:-$QRP_DEFAULT_UI_PORT}"

bash "$ROOT/scripts/setup-qrp.sh"
# shellcheck source=/dev/null
source "$ROOT/logs/runtime.env"

API_PORT="${API_PORT:-${QRP_API_PORT}}"
UI_PORT="${UI_PORT:-${QRP_UI_PORT}}"
API_TARGET="http://127.0.0.1:${API_PORT}"
PY="$ROOT/backend/.venv/bin/python"
mkdir -p "$ROOT/logs"

if qrp_port_listening "$API_PORT" && ! qrp_is_qrp_api "$API_PORT"; then
  API_PORT="$(qrp_pick_api_port)" || qrp_die "No free API port"
  API_TARGET="http://127.0.0.1:${API_PORT}"
  qrp_warn "Requested API port busy — using :${API_PORT}"
fi

if ! qrp_is_qrp_api "$API_PORT"; then
  qrp_log "Start API :${API_PORT} (0.0.0.0)"
  nohup "$PY" -m uvicorn qre.main:app --app-dir "$ROOT/backend" --host 0.0.0.0 --port "$API_PORT" \
    >"$ROOT/logs/api.log" 2>&1 &
  echo $! >"$ROOT/logs/api.pid"
  for _ in $(seq 1 60); do
    qrp_is_qrp_api "$API_PORT" && break
    sleep 0.25
  done
  qrp_is_qrp_api "$API_PORT" || qrp_die "API failed (logs/api.log)"
else
  qrp_log "API already on :${API_PORT}"
fi

if qrp_port_listening "$UI_PORT" && ! curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null; then
  UI_PORT="$(qrp_pick_ui_port)" || qrp_die "No free UI port"
  qrp_warn "Requested UI port busy — using :${UI_PORT}"
fi

if curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null; then
  qrp_log "UI already on :${UI_PORT}"
else
  qrp_log "Start UI :${UI_PORT} (0.0.0.0) → ${API_TARGET}"
  nohup env PATH="$PATH" QRP_API_TARGET="$API_TARGET" \
    bash -c "cd $(printf %q "$ROOT/frontend") && npm run dev -- --host 0.0.0.0 --port ${UI_PORT}" \
    >"$ROOT/logs/ui.log" 2>&1 &
  echo $! >"$ROOT/logs/ui.pid"
  for _ in $(seq 1 80); do
    curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null && break
    sleep 0.25
  done
fi

qrp_write_runtime_env "$ROOT" "$API_PORT" "$UI_PORT"

qrp_log "Portal  http://0.0.0.0:${UI_PORT}/qrp"
qrp_log "API     http://0.0.0.0:${API_PORT}/healthz"
qrp_log "Admin   admin / Admin-Strong-Pw-2026"
qrp_log "Ports   API=${API_PORT} UI=${UI_PORT} PG=${QRP_PGPORT:-$QRP_DEFAULT_PGPORT}"
