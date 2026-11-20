import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/hooks'
import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { AuthOutlineField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FieldAlert, FormBanner, FormShakeShell, mapApiFieldErrors } from '@/components/auth/FormAlerts'
import { AuthBackdropSync } from '@/components/auth/authBackdrop'
import { buildCaptchaPayload, validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'
import { parseForm } from '@/lib/validation/parseForm'
import { safeReturnPath } from '@/lib/safeReturnPath'
import { loginSchema } from '@/lib/validation/schemas'

const showLabCredentialsHint = import.meta.env.VITE_QRE_ENV !== 'production'

/** Matches backend `lab_credentials.LAB_UNIFIED_PASSWORD` after migrate + API restart. */
const LAB_ADMIN_USER = 'admin'
const LAB_UNIFIED_PASSWORD = 'quantum2026'

type LoginLocationState = {
  from?: string
  registeredOrg?: string
  registeredUser?: string
  accessRequest?: boolean
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const locState = (location.state as LoginLocationState | null) ?? {}
  const from = safeReturnPath(locState.from)
  const registeredNotice =
    locState.registeredOrg && locState.registeredUser
      ? `Organization “${locState.registeredOrg}” is ready. Sign in as ${locState.registeredUser}.`
      : locState.accessRequest
        ? 'Sign in after your organization administrator has created your account.'
        : ''
  const captchaEnabled = useAuthCaptchaRequired()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [captchaEpoch, setCaptchaEpoch] = useState(0)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState(registeredNotice)
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
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapApiFieldErrors(err.fieldErrors)
        setFields(mapped)
        const generic =
          err.status === 401
            ? showLabCredentialsHint
              ? `Sign-in failed. Use ${LAB_ADMIN_USER} or any demo role with password ${LAB_UNIFIED_PASSWORD}. Restart the API after migrate if the account was just created.`
              : 'Sign-in failed. Check username and password.'
            : err.detail || 'Sign in failed'
        setBanner(Object.keys(mapped).length ? '' : generic)
      } else {
        setBanner(err instanceof Error ? err.message : 'Sign in failed')
      }
      if (captchaEnabled && captchaId) {
        setCaptchaEpoch((n) => n + 1)
        setCaptchaCode('')
        setCaptchaId('')
        setCaptchaOn(false)
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
      subtitle="Sign in to your organization workspace with portal credentials."
      footer={<AuthFooterLinks showForgot showRegister />}
    >
      <FormShakeShell shakeKey={banner} className="space-y-4">
      <AuthBackdropSync username={username} password={password} captchaInput={captchaCode} />
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormBanner message={banner} />
        {showLabCredentialsHint ? (
          <p className="cert-login-card__lab-hint" role="note">
            Lab: any tenant user (e.g. <span className="font-mono font-semibold text-foreground">{LAB_ADMIN_USER}</span>,{' '}
            <span className="font-mono font-semibold text-foreground">demo_operator</span>) — password{' '}
            <span className="font-mono font-semibold text-foreground">{LAB_UNIFIED_PASSWORD}</span>
          </p>
        ) : null}
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
          key={captchaEpoch}
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
      </FormShakeShell>
    </AuthPanel>
  )
}