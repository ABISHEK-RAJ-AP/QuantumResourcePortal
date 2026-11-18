#!/usr/bin/env bash
# Smoke-test QRP stack (QRP :8010 + Vite :5176; Q-TeleScope may keep :8000).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/qrp-ports.sh
source "$ROOT/scripts/lib/qrp-ports.sh"
# shellcheck source=scripts/lib/vm-common.sh
source "$ROOT/scripts/lib/vm-common.sh"
API="http://127.0.0.1:${API_PORT}"
UI="http://127.0.0.1:${UI_PORT}"

fail() { printf '\033[1;31m[qrp-verify]\033[0m FAIL: %s\n' "$*" >&2; exit 1; }
ok() { printf '\033[1;32m[qrp-verify]\033[0m OK %s\n' "$*"; }

curl_json() {
  local url="$1"
  local name="$2"
  local body
  body="$(curl -sf -m 8 "$url")" || fail "$name unreachable at $url (run: bash scripts/vm-setup.sh)"
  [[ -n "$body" ]] || fail "$name empty body"
  ok "$name"
  printf '%s' "$body"
}

echo "=== QRP prerequisites ==="
vm_postgres_ready && ok "PostgreSQL" || fail "PostgreSQL not ready — create DB per README / vm_postgres_hint in vm-setup"

if grep -q '^QRE_REDIS_URL=redis://' "$ROOT/backend/.env" 2>/dev/null; then
  port="${REDIS_PORT:-6379}"
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli -p "$port" ping 2>/dev/null | grep -q PONG && ok "Redis :${port}" || fail "QRE_REDIS_URL set but Redis not responding"
  elif command -v valkey-cli >/dev/null 2>&1; then
    valkey-cli -p "$port" ping 2>/dev/null | grep -q PONG && ok "Valkey :${port}" || fail "QRE_REDIS_URL set but Valkey not responding"
  else
    vm_log "SKIP Redis CLI (install redis-tools or valkey)"
  fi
fi

echo "=== QRP API direct :${API_PORT} ==="
vm_qrp_api_ok "$API_PORT" || fail "Port ${API_PORT} is not the QRP gateway (wrong app or API down)"
curl_json "${API}/healthz" "healthz" >/dev/null
curl_json "${API}/readyz" "readyz" >/dev/null
curl_json "${API}/api/v1/auth/captcha" "auth/captcha" >/dev/null
caps="$(curl_json "${API}/api/v1/auth/capabilities" "auth/capabilities")"
echo "$caps" | grep -q '"cache"' || fail "auth/capabilities missing cache block"
session="$(curl_json "${API}/api/v1/auth/session" "auth/session")"
echo "$session" | grep -q '"authenticated"' || fail "auth/session missing authenticated field"

echo "=== Vite proxy :${UI_PORT} ==="
vm_proxy_ok "$UI_PORT" || fail "Vite proxy broken (502) — restart UI: kill ui.pid and bash scripts/vm-setup.sh"
ok "proxy auth/session + captcha"

echo "=== All QRP checks passed ==="