# Quantum Resource Portal ports — do not collide with Q-TeleScope.
# TeleScope (other repo): API :8000, Vite dev :5173, preview :4173.
# QRP defaults: API :8010, Vite dev :5176, preview :4176.
#
# Override only: QRP_API_PORT, QRP_UI_PORT, QRP_PREVIEW_PORT, QRP_API_TARGET
# Emergency only: QRP_ALLOW_TELESCOPE_PORTS=1 to bind QRP on TeleScope ports (not supported).

QRP_TELESCOPE_API_PORT=8000
QRP_TELESCOPE_UI_PORT=5173
QRP_TELESCOPE_PREVIEW_PORT=4173

_qrp_warn() { printf '\033[1;33m[qrp-ports]\033[0m %s\n' "$*" >&2; }

_qrp_block_tele_scope_port() {
  local name="$1"
  local value="$2"
  local fallback="$3"
  if [[ "${QRP_ALLOW_TELESCOPE_PORTS:-}" == "1" ]]; then
    printf '%s' "$value"
    return
  fi
  case "$value" in
    "$QRP_TELESCOPE_API_PORT"|"$QRP_TELESCOPE_UI_PORT"|"$QRP_TELESCOPE_PREVIEW_PORT")
      _qrp_warn "$name=$value is reserved for Q-TeleScope — QRP uses $fallback"
      printf '%s' "$fallback"
      ;;
    *) printf '%s' "$value" ;;
  esac
}

# Honour explicit QRP_*; ignore stale API_PORT/UI_PORT unless QRP_* unset (legacy shells).
if [[ -z "${QRP_API_PORT:-}" && -n "${API_PORT:-}" ]]; then
  QRP_API_PORT="$API_PORT"
fi
if [[ -z "${QRP_UI_PORT:-}" && -n "${UI_PORT:-}" ]]; then
  QRP_UI_PORT="$UI_PORT"
fi

QRP_API_PORT="${QRP_API_PORT:-8010}"
QRP_UI_PORT="${QRP_UI_PORT:-5176}"
QRP_PREVIEW_PORT="${QRP_PREVIEW_PORT:-4176}"

QRP_API_PORT="$(_qrp_block_tele_scope_port QRP_API_PORT "$QRP_API_PORT" 8010)"
QRP_UI_PORT="$(_qrp_block_tele_scope_port QRP_UI_PORT "$QRP_UI_PORT" 5176)"
QRP_PREVIEW_PORT="$(_qrp_block_tele_scope_port QRP_PREVIEW_PORT "$QRP_PREVIEW_PORT" 4176)"

export API_PORT="$QRP_API_PORT"
export UI_PORT="$QRP_UI_PORT"
export QRP_PREVIEW_PORT

export QRP_API_TARGET="${QRP_API_TARGET:-http://127.0.0.1:${QRP_API_PORT}}"
if [[ "${QRP_ALLOW_TELESCOPE_PORTS:-}" != "1" ]] && [[ "$QRP_API_TARGET" == *":8000"* ]]; then
  _qrp_warn "QRP_API_TARGET pointed at :8000 — resetting to http://127.0.0.1:${QRP_API_PORT}"
  export QRP_API_TARGET="http://127.0.0.1:${QRP_API_PORT}"
fi