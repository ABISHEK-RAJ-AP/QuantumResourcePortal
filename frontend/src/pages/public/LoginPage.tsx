import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/hooks'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { CaptchaField } from '@/components/auth/CaptchaField'
import { FieldAlert, FormBanner, mapApiFieldErrors } from '@/components/auth/FormAlerts'

const LAB_PRESETS = [{ label: 'Admin', username: 'admin', password: 'Admin-Strong-Pw-2026' }] as const
const showLabPresets = import.meta.env.VITE_QRE_ENV !== 'production'
const captchaEnabled = import.meta.env.VITE_QRE_CAPTCHA === '1'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const from = (location.state as { from?: string } | null)?.from || '/qrp'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  async function doLogin(user: string, pass: string) {
    setBusy(true)
    setBanner('')
    setFields({})
    try {
      if (!user.trim()) {
        setFields({ username: 'Username is required' })
        return
      }
      if (!pass) {
        setFields({ password: 'Password is required' })
        return
      }
      if (captchaEnabled && captchaOn && !captchaCode.trim()) {
        setFields({ captcha_code: 'Enter the characters shown' })
        return
      }
      const captcha =
        captchaEnabled && captchaOn && captchaId && captchaCode
          ? { captcha_id: captchaId, captcha_code: captchaCode }
          : undefined
      const result = await login(user.trim(), pass, captcha)
      if (result?.status === 'MFA_REQUIRED' || result?.status === 'MFA_CHALLENGE') {
        navigate('/mfa', {
          replace: true,
          state: { challenge_id: result.challenge_id, from },
        })
        return
      }
      navigate(from.startsWith('/') ? from : '/qrp', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapApiFieldErrors(err.fieldErrors)
        setFields(mapped)
        setBanner(Object.keys(mapped).length ? '' : err.detail || 'Sign in failed')
      } else {
        setBanner(err instanceof Error ? err.message : 'Sign in failed')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await doLogin(username, password)
  }

  return (
    <AuthPanel
      title="Sign in"
      subtitle="Use your portal credentials"
      footer={<AuthFooterLinks showForgot showRegister />}
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormBanner message={banner} />
        <label className="block text-sm font-medium">
          Username
          <input
            required
            autoComplete="username"
            className="field-input"
            value={username}
            aria-invalid={Boolean(fields.username)}
            aria-describedby={fields.username ? 'user-err' : undefined}
            onChange={(e) => setUsername(e.target.value)}
          />
          <FieldAlert id="user-err" message={fields.username} />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            required
            type="password"
            autoComplete="current-password"
            className="field-input"
            value={password}
            aria-invalid={Boolean(fields.password)}
            aria-describedby={fields.password ? 'pass-err' : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldAlert id="pass-err" message={fields.password} />
        </label>
        {captchaEnabled ? (
          <div>
            <CaptchaField
              value={captchaCode}
              onChange={setCaptchaCode}
              onChallenge={setCaptchaId}
              onAvailability={setCaptchaOn}
            />
            <FieldAlert message={fields.captcha_code || fields.captcha_id} />
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {showLabPresets ? (
        <div className="mt-4 rounded-[var(--radius-inner)] border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Demo account</p>
          <div className="grid grid-cols-1 gap-2">
            {LAB_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                className="btn-secondary text-sm"
                onClick={() => {
                  setUsername(p.username)
                  setPassword(p.password)
                  void doLogin(p.username, p.password)
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-center text-sm">
        <Link className="font-medium text-primary hover:underline" to="/forgot-password">
          Forgot password
        </Link>
      </p>
    </AuthPanel>
  )
}
