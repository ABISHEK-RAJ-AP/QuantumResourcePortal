# Default ports for Quantum Resource Portal — avoid Q-TeleScope (:8000 API, :5173/:4173 UI).
# Override: API_PORT, UI_PORT, QRP_API_TARGET, or source this and export before scripts run.
QRP_API_PORT="${QRP_API_PORT:-8010}"
QRP_UI_PORT="${QRP_UI_PORT:-5176}"
QRP_PREVIEW_PORT="${QRP_PREVIEW_PORT:-4176}"
export API_PORT="${API_PORT:-$QRP_API_PORT}"
export UI_PORT="${UI_PORT:-$QRP_UI_PORT}"
export QRP_API_TARGET="${QRP_API_TARGET:-http://127.0.0.1:${API_PORT}}"