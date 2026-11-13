#!/usr/bin/env bash
# VM / headless: install deps, lab DB, migrate, start QRP API + UI (this repo only).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/qrp-common.sh
source "$ROOT/scripts/lib/qrp-common.sh"

cd "$ROOT"
qrp_bootstrap_path

command -v git >/dev/null && git pull --ff-only || qrp_log "git pull skipped"

bash "$ROOT/scripts/setup-qrp.sh"
# shellcheck source=/dev/null
source "$ROOT/logs/runtime.env"

API_PORT="${API_PORT:-${QRP_API_PORT:-8000}}"
UI_PORT="${UI_PORT:-${QRP_UI_PORT:-5176}}"
API_TARGET="http://127.0.0.1:${API_PORT}"
PY="$ROOT/backend/.venv/bin/python"
mkdir -p "$ROOT/logs"

# Prefer caller-forced API_PORT; rewrite runtime.env if needed.
if [[ "${API_PORT}" != "${QRP_API_PORT:-}" ]]; then
  if qrp_port_listening "$API_PORT" && ! qrp_is_qrp_api "$API_PORT"; then
    qrp_die "Port ${API_PORT} is in use by another process. Set API_PORT to a free port."
  fi
fi

if ! qrp_is_qrp_api "$API_PORT"; then
  qrp_log "Start API :${API_PORT}"
  nohup "$PY" -m uvicorn qre.main:app --app-dir "$ROOT/backend" --host 0.0.0.0 --port "$API_PORT" \
    >"$ROOT/logs/api.log" 2>&1 &
  echo $! >"$ROOT/logs/api.pid"
  for _ in $(seq 1 40); do
    qrp_is_qrp_api "$API_PORT" && break
    sleep 0.25
  done
  qrp_is_qrp_api "$API_PORT" || qrp_die "API failed (logs/api.log)"
else
  qrp_log "API already on :${API_PORT}"
fi

if curl -sf -m 1 -o /dev/null "http://127.0.0.1:${UI_PORT}/" 2>/dev/null; then
  qrp_log "UI already on :${UI_PORT}"
else
  qrp_log "Start UI :${UI_PORT}"
  nohup bash -lc "cd $(printf %q "$ROOT/frontend") && QRP_API_TARGET=$(printf %q "$API_TARGET") npm run dev -- --host 0.0.0.0 --port ${UI_PORT}" \
    >"$ROOT/logs/ui.log" 2>&1 &
  echo $! >"$ROOT/logs/ui.pid"
fi

cat >"$ROOT/logs/runtime.env" <<EOF
QRP_API_PORT=${API_PORT}
QRP_UI_PORT=${UI_PORT}
QRP_API_TARGET=${API_TARGET}
QRP_PGPORT=${QRP_PGPORT:-}
QRP_DATABASE_URL=${QRP_DATABASE_URL:-}
EOF

qrp_log "Portal  http://0.0.0.0:${UI_PORT}/qrp"
qrp_log "API     http://0.0.0.0:${API_PORT}/healthz"
qrp_log "Admin   admin / Admin-Strong-Pw-2026"
