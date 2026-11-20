const LAB_PRESETS = [
  { label: 'Platform admin', username: 'admin', password: 'Admin-Strong-Pw-2026' },
  { label: 'Demo operator', username: 'demo_operator', password: 'Demo-Strong-Pw-2026' },
] as const

/** Lab quick-fill + optional one-click sign-in (CAPTCHA must still pass server check). */
export function AuthDemoPresets({
  visible,
  disabled,
  onSelect,
  onSignIn,
}: {
  visible: boolean
  disabled?: boolean
  onSelect: (username: string, password: string) => void
  onSignIn?: (username: string, password: string) => void | Promise<void>
}) {
  if (!visible) return null

  return (
    <details className="auth-demo-presets" open>
      <summary className="auth-demo-presets__summary">Demo accounts (lab)</summary>
      <p className="auth-demo-presets__hint">
        Enter the security check below, then use Sign in or the shortcut button. API creates <code>admin</code> on
        first start if missing.
      </p>
      <div className="auth-demo-presets__grid" role="group" aria-label="Demo account shortcuts">
        {LAB_PRESETS.map((p) => (
          <div key={p.label} className="auth-demo-presets__row">
            <button
              type="button"
              className="auth-demo-presets__btn"
              disabled={disabled}
              onClick={() => onSelect(p.username, p.password)}
            >
              {p.label}
            </button>
            {onSignIn ? (
              <button
                type="button"
                className="auth-demo-presets__btn auth-demo-presets__btn--signin"
                disabled={disabled}
                onClick={() => {
                  onSelect(p.username, p.password)
                  void onSignIn(p.username, p.password)
                }}
              >
                Sign in
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  )
}