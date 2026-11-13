import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/hooks'
import { CaptchaField } from '@/components/auth/CaptchaField'
import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import { useTheme } from '@/components/theme/ThemeProvider'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { cn } from '@/lib/utils'

/** Lab demo presets (match scripts/setup-qrp.sh bootstrap). Shown when VITE_QRE_ENV≠production. */
const LAB_PRESETS = [
  { label: 'Admin', username: 'admin', password: 'Admin-Strong-Pw-2026' },
] as const

const showLabPresets = import.meta.env.VITE_QRE_ENV !== 'production'
const captchaEnabled = import.meta.env.VITE_QRE_CAPTCHA === '1'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const from = (location.state as { from?: string } | null)?.from || '/qrp'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function doLogin(user: string, pass: string) {
    setBusy(true)
    setError('')
    try {
      const captcha =
        captchaEnabled && captchaOn && captchaId && captchaCode
          ? { captcha_id: captchaId, captcha_code: captchaCode }
          : undefined
      await login(user.trim(), pass, captcha)
      navigate(from.startsWith('/') ? from : '/qrp', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await doLogin(username, password)
  }

  return (
    <PublicShell>
      <div className="relative flex-1">
        <CyberMatrixHero
          showDefaultContent={false}
          className={cn('min-h-[calc(100svh-104px)]', !dark && 'bg-surface')}
        >
          <div className="fade-up auth-panel-rise mx-auto w-full max-w-md rounded-2xl border border-border bg-card/95 p-8 text-foreground shadow-raised backdrop-blur-md">
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-sm font-semibold">C-DAC</p>
                <p className="text-xs text-muted-foreground">Sign in to Quantum Resource Portal</p>
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your portal credentials.</p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm font-medium">
                Username
                <input
                  required
                  autoComplete="username"
                  className="field-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                Password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  className="field-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {captchaEnabled ? (
                <CaptchaField
                  value={captchaCode}
                  onChange={setCaptchaCode}
                  onChallenge={setCaptchaId}
                  onAvailability={setCaptchaOn}
                />
              ) : null}
              {error && <p className="text-sm text-critical">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {showLabPresets ? (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Demo accounts
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {LAB_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      disabled={busy}
                      className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
                      onClick={() => {
                        setUsername(p.username)
                        setPassword(p.password)
                        setError('')
                        void doLogin(p.username, p.password)
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Fills admin / Admin-Strong-Pw-2026 and signs in.
                </p>
              </div>
            ) : null}

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Need an account?{' '}
              <Link className="font-medium text-primary hover:underline" to="/register">
                Request access
              </Link>
              {' · '}
              <Link className="font-medium text-primary hover:underline" to="/">
                Home
              </Link>
            </p>
          </div>
        </CyberMatrixHero>
      </div>
    </PublicShell>
  )
}
