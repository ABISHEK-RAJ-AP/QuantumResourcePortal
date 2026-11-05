import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { authFetch } from '@/api/qre'
import { LogoMark } from '@/components/brand/LogoMark'
import { PublicShell } from '@/components/marketing/PublicShell'
import CyberMatrixHero from '@/components/ui/cyber-matrix-hero'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

type Captcha = { captcha_id: string; captcha_image: string }

export function RegisterPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const [form, setForm] = useState({
    username: '',
    email: '',
    full_name: '',
    org: 'C-DAC',
    password: '',
    role: 'Operator',
  })
  const [captchaInput, setCaptchaInput] = useState('')
  const [captcha, setCaptcha] = useState<Captcha | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!captcha) return
    setBusy(true)
    setError('')
    try {
      await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          captcha_id: captcha.captcha_id,
          captcha_code: captchaInput,
        }),
      })
      navigate('/login', { state: { from: '/qrp' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      void loadCaptcha()
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
              'fade-up auth-panel-rise mx-auto w-full max-w-lg rounded-2xl border p-8 shadow-raised backdrop-blur-md',
              dark ? 'border-white/15 bg-black/75 text-white' : 'border-border bg-card/95 text-foreground',
            )}
          >
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className={cn('h-9 w-auto', dark && 'brightness-0 invert')} />
              <div>
                <p className="text-sm font-semibold">Create account</p>
                <p className={cn('text-xs', dark ? 'text-white/55' : 'text-muted-foreground')}>
                  C-DAC Quantum Resource Portal
                </p>
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Request access</h2>
            <p className={cn('mt-1 text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
              Self-register as Operator or Researcher.
            </p>
            <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
              {(
                [
                  ['username', 'Username', 'text'],
                  ['email', 'Email', 'email'],
                  ['full_name', 'Full name', 'text'],
                  ['org', 'Organisation', 'text'],
                  ['password', 'Password', 'password'],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key} className="block text-sm font-medium sm:col-span-1">
                  {label}
                  <input
                    required
                    type={type}
                    className={cn('field-input', dark && 'border-white/15 bg-white/5 text-white')}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="block text-sm font-medium sm:col-span-2">
                Role
                <select
                  className={cn('field-input', dark && 'border-white/15 bg-white/5 text-white')}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="Operator">Operator</option>
                  <option value="Researcher">Researcher</option>
                </select>
              </label>
              <div className="space-y-2 sm:col-span-2">
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
              {error && <p className="text-sm text-critical sm:col-span-2">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 sm:col-span-2">
                {busy ? 'Creating…' : 'Create account'}
              </button>
            </form>
            <p className={cn('mt-5 text-center text-sm', dark ? 'text-white/55' : 'text-muted-foreground')}>
              Already registered?{' '}
              <Link className="font-medium text-primary hover:underline" to="/login">
                Sign in
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
