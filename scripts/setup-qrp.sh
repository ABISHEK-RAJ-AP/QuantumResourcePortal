#!/usr/bin/env bash
# One-shot lab setup for Quantum Resource Portal (this repo only).
# Auto-installs missing Python/Node/Postgres tools, private DB on :5433, migrate, admin.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/qrp-common.sh
source "$ROOT/scripts/lib/qrp-common.sh"

cd "$ROOT"
qrp_bootstrap_path
qrp_ensure_curl
qrp_ensure_python
qrp_ensure_node
qrp_ensure_lab_postgres "$ROOT"
qrp_write_env "$ROOT"
qrp_ensure_backend_venv "$ROOT"
qrp_ensure_frontend "$ROOT"
qrp_migrate "$ROOT"
qrp_bootstrap_lab_admin "$ROOT"

API_PORT="$(qrp_pick_api_port)" || qrp_die "No free API port (tried 8088/8001/8002/8080/8010)"
UI_PORT="$(qrp_pick_ui_port)" || qrp_die "No free UI port (tried 5176–5178/4173)"

qrp_write_runtime_env "$ROOT" "$API_PORT" "$UI_PORT"

qrp_log "Setup OK"
qrp_log "  DB   ${QRP_DATABASE_URL}"
qrp_log "  API  :${API_PORT}"
qrp_log "  UI   :${UI_PORT}"
qrp_log "Next:  bash scripts/start-qrp.sh   (or bash scripts/vm-setup.sh)"
