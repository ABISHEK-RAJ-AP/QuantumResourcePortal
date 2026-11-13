#!/usr/bin/env bash
# One-shot lab setup for Quantum Resource Portal (this repo only).
# Installs missing Python/Node deps, starts lab Postgres if needed, migrates, bootstraps admin.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/qrp-common.sh
source "$ROOT/scripts/lib/qrp-common.sh"

cd "$ROOT"
qrp_bootstrap_path
qrp_ensure_python
qrp_ensure_node
qrp_ensure_lab_postgres "$ROOT"
qrp_write_env "$ROOT"
qrp_ensure_backend_venv "$ROOT"
qrp_ensure_frontend "$ROOT"
qrp_migrate "$ROOT"
qrp_bootstrap_lab_admin "$ROOT"

API_PORT="$(qrp_pick_api_port)" || qrp_die "No free API port in 8000–8002/8080"
UI_PORT="${UI_PORT:-5176}"

mkdir -p "$ROOT/logs"
cat >"$ROOT/logs/runtime.env" <<EOF
QRP_API_PORT=${API_PORT}
QRP_UI_PORT=${UI_PORT}
QRP_API_TARGET=http://127.0.0.1:${API_PORT}
QRP_PGPORT=${QRP_PGPORT}
QRP_DATABASE_URL=${QRP_DATABASE_URL}
EOF

qrp_log "Setup OK"
qrp_log "  DB   ${QRP_DATABASE_URL}"
qrp_log "  API  will use :${API_PORT} (see logs/runtime.env)"
qrp_log "  UI   :${UI_PORT}"
qrp_log "Next:  bash scripts/start-qrp.sh"
