#!/usr/bin/env bash
# VM: Quantum Resource Portal only. Postgres + QRP API :8000 + Vite :5176.
# Does NOT use Redis. Does NOT start Q-TeleScope — port 8000 must be this repo's qre.main:app.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/lib/vm-common.sh
source "$ROOT/scripts/lib/vm-common.sh"

vm_bootstrap_path
API_PORT="${API_PORT:-8000}"
UI_PORT="${UI_PORT:-5176}"
mkdir -p "$ROOT/logs"

if command -v git >/dev/null; then
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    CUR="$(git branch --show-current 2>/dev/null || true)"
    if [[ "$CUR" == "main" ]]; then
      git pull --ff-only origin main || vm_log "git pull skipped (diverged — bash scripts/vm-pull-main.sh)"
    else
      vm_log "Not on main ($CUR) — skipping pull"
    fi
  fi
fi

vm_ensure_venv "$ROOT"
vm_ensure_env_files "$ROOT"

if ! vm_postgres_ready; then
  vm_log "WARN: PostgreSQL not responding on localhost:5432"
  vm_postgres_hint
fi

vm_log "Database migrate"
make migrate || vm_die "alembic failed — fix Postgres then re-run (see README Quick start)"

command -v npm >/dev/null || vm_die "npm missing (install Node 20+ or nvm)"
if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  vm_log "npm install"
  (cd "$ROOT/frontend" && npm install)
fi

if vm_qrp_api_ok "$API_PORT"; then
  vm_log "QRP API already healthy on :${API_PORT}"
else
  if curl -sf -m 1 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1; then
    vm_log "Port ${API_PORT} is in use but is NOT QRP (likely Q-TeleScope or stale process) — replacing"
  fi
  vm_start_api "$ROOT" "$API_PORT"
fi

if vm_proxy_ok "$UI_PORT"; then
  vm_log "Vite + proxy already OK on :${UI_PORT}"
else
  if curl -sf -m 1 "http://127.0.0.1:${UI_PORT}/" >/dev/null 2>&1; then
    vm_log "Vite on :${UI_PORT} but /api proxy failing — restarting UI"
  fi
  vm_start_ui "$ROOT" "$UI_PORT"
  sleep 2
  vm_proxy_ok "$UI_PORT" || vm_log "WARN: proxy still failing — check logs/ui.log and logs/api.log"
fi

vm_log "Running stack verification"
bash "$ROOT/scripts/verify-qrp-stack.sh" || vm_die "Verification failed — fix issues above and re-run"

vm_log "Portal  http://0.0.0.0:${UI_PORT}/login"
vm_log "API     http://0.0.0.0:${API_PORT}/api/v1/docs"
vm_log "Redis   not required for QRP"
vm_log "Admin   admin / Admin-Strong-Pw-2026 (lab, after migrate seed — see docs/RBAC_DELIVERY.md)"