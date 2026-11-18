const LAB_PRESETS = [{ label: 'Admin', username: 'admin', password: 'Admin-Strong-Pw-2026' }] as const

/** Lab-only quick-fill — collapsed by default (TeleScope pattern). Does not auto-submit (CAPTCHA must be entered). */
export function AuthDemoPresets({
  visible,
  disabled,
  onSelect,
}: {
  visible: boolean
  disabled?: boolean
  onSelect: (username: string, password: string) => void
}) {
  if (!visible) return null

  return (
    <details className="auth-demo-presets">
      <summary className="auth-demo-presets__summary">Demo accounts (lab)</summary>
      <p className="auth-demo-presets__hint">Fills credentials only. Complete the security check, then sign in.</p>
      <div className="auth-demo-presets__grid" role="group" aria-label="Demo account shortcuts">
        {LAB_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="auth-demo-presets__btn"
            disabled={disabled}
            onClick={() => onSelect(p.username, p.password)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </details>
  )
}