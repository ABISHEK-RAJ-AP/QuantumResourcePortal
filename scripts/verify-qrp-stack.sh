#!/usr/bin/env bash
# Smoke-test QRP stack (QRP backend only — no Redis, no TeleScope :8000).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/vm-common.sh
source "$ROOT/scripts/lib/vm-common.sh"

API_PORT="${API_PORT:-8000}"
UI_PORT="${UI_PORT:-5176}"
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

echo "=== QRP prerequisites (Postgres, not Redis) ==="
vm_postgres_ready && ok "PostgreSQL" || fail "PostgreSQL not ready — create DB per README / vm_postgres_hint in vm-setup"

echo "=== QRP API direct :${API_PORT} ==="
vm_qrp_api_ok "$API_PORT" || fail "Port ${API_PORT} is not the QRP gateway (wrong app or API down)"
curl_json "${API}/healthz" "healthz" >/dev/null
curl_json "${API}/readyz" "readyz" >/dev/null
curl_json "${API}/api/v1/auth/captcha" "auth/captcha" >/dev/null
curl_json "${API}/api/v1/auth/capabilities" "auth/capabilities" >/dev/null
session="$(curl_json "${API}/api/v1/auth/session" "auth/session")"
echo "$session" | grep -q '"authenticated"' || fail "auth/session missing authenticated field"

echo "=== Vite proxy :${UI_PORT} ==="
vm_proxy_ok "$UI_PORT" || fail "Vite proxy broken (502) — restart UI: kill ui.pid and bash scripts/vm-setup.sh"
ok "proxy auth/session + captcha"

echo "=== All QRP checks passed ==="