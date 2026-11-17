import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/hooks'
import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { AuthOutlineField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FieldAlert, FormBanner, mapApiFieldErrors } from '@/components/auth/FormAlerts'
import { buildCaptchaPayload, isAuthCaptchaEnabled, validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { parseForm } from '@/lib/validation/parseForm'
import { loginSchema } from '@/lib/validation/schemas'

const LAB_PRESETS = [{ label: 'Admin', username: 'admin', password: 'Admin-Strong-Pw-2026' }] as const
const showLabPresets = import.meta.env.VITE_QRE_ENV !== 'production'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const from = (location.state as { from?: string } | null)?.from || '/qrp'
  const captchaEnabled = isAuthCaptchaEnabled()

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
      const parsed = parseForm(loginSchema, { username: user, password: pass })
      if (!parsed.ok) {
        setFields(parsed.fieldErrors)
        if (parsed.formError) setBanner(parsed.formError)
        return
      }
      const captchaErr = validateCaptchaBeforeSubmit(captchaEnabled, captchaOn, captchaCode)
      if (captchaErr) {
        if (captchaErr.includes('Enter the')) setFields({ captcha_code: captchaErr })
        else setBanner(captchaErr)
        return
      }
      const captcha = buildCaptchaPayload(captchaEnabled, captchaOn, captchaId, captchaCode)
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
        <AuthOutlineField label="Username" htmlFor="login-username">
          <input
            id="login-username"
            required
            autoComplete="username"
            className={authOutlineControlClass}
            value={username}
            aria-invalid={Boolean(fields.username)}
            onChange={(e) => setUsername(e.target.value)}
          />
        </AuthOutlineField>
        <FieldAlert message={fields.username} />
        <AuthOutlineField label="Password" htmlFor="login-password">
          <input
            id="login-password"
            required
            type="password"
            autoComplete="current-password"
            className={authOutlineControlClass}
            value={password}
            aria-invalid={Boolean(fields.password)}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthOutlineField>
        <FieldAlert message={fields.password} />
        <AuthCaptchaBlock
          captchaCode={captchaCode}
          onCodeChange={setCaptchaCode}
          onChallenge={setCaptchaId}
          onAvailability={setCaptchaOn}
          fieldError={fields.captcha_code || fields.captcha_id}
        />
        <button type="submit" disabled={busy} className="btn-primary auth-cta qrp-auth-submit w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {showLabPresets ? (
        <details className="auth-demo-presets mt-5">
          <summary className="auth-demo-presets__summary">Demo accounts</summary>
          <div className="mt-2 grid gap-2 p-3">
            {LAB_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={busy}
                className="btn-secondary text-base"
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
        </details>
      ) : null}
    </AuthPanel>
  )
}