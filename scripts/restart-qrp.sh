#!/usr/bin/env bash
# Stop lab API/UI (and optional private Postgres), pull, then full vm-setup start.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/qrp-common.sh
source "$ROOT/scripts/lib/qrp-common.sh"

cd "$ROOT"
qrp_bootstrap_path

qrp_log "Stopping previous QRP processes…"
if [[ -f logs/api.pid ]]; then kill "$(cat logs/api.pid)" 2>/dev/null || true; rm -f logs/api.pid; fi
if [[ -f logs/ui.pid ]]; then kill "$(cat logs/ui.pid)" 2>/dev/null || true; rm -f logs/ui.pid; fi
# Best-effort: anything we started for this repo's ports
if [[ -f logs/runtime.env ]]; then
  # shellcheck source=/dev/null
  source logs/runtime.env
  for p in "${QRP_API_PORT:-}" "${QRP_UI_PORT:-}"; do
    [[ -n "$p" ]] || continue
    if qrp_have_cmd ss; then
      pid="$(ss -tlnp 2>/dev/null | awk -v p=":$p" '$4 ~ p {print}' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)"
      [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null || true
    fi
  done
fi

if [[ "${QRP_RESTART_DB:-0}" == "1" ]] && [[ -f .pgdata/postmaster.agent.pid ]]; then
  kill "$(cat .pgdata/postmaster.agent.pid)" 2>/dev/null || true
  rm -f .pgdata/postmaster.agent.pid
fi

sleep 1
export QRP_SKIP_PULL="${QRP_SKIP_PULL:-0}"
bash "$ROOT/scripts/vm-setup.sh"
