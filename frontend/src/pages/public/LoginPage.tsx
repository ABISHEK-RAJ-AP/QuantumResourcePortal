import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { authFetch } from '@/api/qre'
import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { useTheme } from '@/components/theme/ThemeProvider'
import { setSession, type SessionUser } from '@/lib/session'
import { cn } from '@/lib/utils'

type Captcha = { captcha_id: string; captcha_image: string }

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const from = (location.state as { from?: string } | null)?.from || '/qrp'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [captcha, setCaptcha] = useState<Captcha | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [ldapHint, setLdapHint] = useState('')

  async function loadCaptcha(attempt = 0) {
    setCaptchaLoading(true)
    try {
      const next = await authFetch<Captcha>('/auth/captcha')
      if (!next?.captcha_id || !next?.captcha_image) {
        throw new Error('Captcha response incomplete')
      }
      setCaptcha(next)
      setCaptchaInput('')
      setError('')
    } catch (err) {
      setCaptcha(null)
      const msg = err instanceof Error ? err.message : 'Could not load captcha'
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 600))
        return loadCaptcha(attempt + 1)
      }
      setError(msg)
    } finally {
      setCaptchaLoading(false)
    }
  }

  useEffect(() => {
    void loadCaptcha()
    void authFetch<{ ldap?: { enabled?: boolean; host?: string | null } }>('/auth/config-status')
      .then((cfg) => {
        if (cfg.ldap?.enabled) {
          setLdapHint(cfg.ldap.host ? `Directory login on (${cfg.ldap.host})` : 'Directory login on')
        }
      })
      .catch(() => undefined)
  }, [])

  function finish(user: SessionUser) {
    setSession(user)
    navigate(from.startsWith('/') ? from : '/qrp', { replace: true })
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mfaToken) {
        const body = await authFetch<{ user: SessionUser }>('/auth/login/mfa', {
          method: 'POST',
          body: JSON.stringify({ mfa_token: mfaToken, code: mfaCode }),
        })
        finish(body.user)
        return
      }
      if (!captcha) return
      const body = await authFetch<{ status?: string; mfa_token?: string; user?: SessionUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          captcha_id: captcha.captcha_id,
          captcha_code: captchaInput,
        }),
      })
      if (body.status === 'MFA_REQUIRED' && body.mfa_token) {
        setMfaToken(body.mfa_token)
        return
      }
      if (!body.user) throw new Error('Sign in returned no session')
      finish(body.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      if (!mfaToken) void loadCaptcha()
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <div className="relative flex-1">
        <CyberMatrixHero
          showDefaultContent={false}
          className={cn('min-h-[calc(100svh-104px)]', !dark && 'bg-surface')}
        >
          <div
            className={cn(
              'fade-up auth-panel-rise mx-auto w-full max-w-md rounded-2xl border p-8 shadow-raised backdrop-blur-md',
              dark ? 'border-white/15 bg-black/75 text-white' : 'border-border bg-card/95 text-foreground',
            )}
          >
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-sm font-semibold">C-DAC</p>
                <p className={cn('text-xs', dark ? 'text-white/55' : 'text-muted-foreground')}>
                  Sign in to Quantum Resource Portal
                </p>
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
            <p className={cn('mt-1 text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
              {mfaToken ? 'Enter the authenticator code.' : 'Portal or directory credentials, plus captcha.'}
            </p>
            {ldapHint ? (
              <p className={cn('mt-2 text-xs', dark ? 'text-white/55' : 'text-muted-foreground')} title="LDAP_URL is set on the API">
                {ldapHint}
              </p>
            ) : null}
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {mfaToken ? (
                <label className="block text-sm font-medium">
                  Authenticator code
                  <input
                    required
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    className={cn('field-input font-mono', dark && 'border-white/15 bg-white/5 text-white')}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                  />
                </label>
              ) : (
              <>
              <label className="block text-sm font-medium">
                Username
                <input
                  required
                  autoComplete="username"
                  className={cn('field-input', dark && 'border-white/15 bg-white/5 text-white')}
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
                  className={cn('field-input', dark && 'border-white/15 bg-white/5 text-white')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <div className="space-y-2">
                <p className="text-sm font-medium">Captcha</p>
                {captcha?.captcha_image ? (
                  <button type="button" onClick={() => void loadCaptcha()} className="block" title="Refresh captcha">
                    <img src={captcha.captcha_image} alt="Captcha challenge" className="h-12 rounded-lg border border-border bg-white" />
                  </button>
                ) : (
                  <p className={cn('text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
                    {captchaLoading ? 'Loading challenge…' : 'Captcha unavailable.'}{' '}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => void loadCaptcha()}>
                      Retry
                    </button>
                  </p>
                )}
                <input
                  required
                  className={cn('field-input font-mono uppercase', dark && 'border-white/15 bg-white/5 text-white')}
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="Enter the code"
                />
              </div>
              </>
              )}
              {error && <p className="text-sm text-critical">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
                {busy ? 'Signing in…' : mfaToken ? 'Verify' : 'Sign in'}
              </button>
              {mfaToken ? (
                <button
                  type="button"
                  className="btn-ghost w-full"
                  onClick={() => {
                    setMfaToken('')
                    setMfaCode('')
                    void loadCaptcha()
                  }}
                >
                  Start over
                </button>
              ) : null}
            </form>
            <p className={cn('mt-4 rounded-lg px-3 py-2 text-center text-xs', dark ? 'bg-white/5 text-white/55' : 'bg-muted text-muted-foreground')}>
              Demo: <span className="font-mono font-medium">admin</span> / <span className="font-mono font-medium">quantum2026</span>
            </p>
            <p className={cn('mt-4 text-center text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
              No account?{' '}
              <Link className="font-medium text-primary hover:underline" to="/register">
                Create one
              </Link>
              {' · '}
              <Link className="font-medium text-primary hover:underline" to="/forgot-password">
                Forgot password
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
