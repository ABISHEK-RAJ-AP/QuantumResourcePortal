import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { authFetch } from '@/api/qre'
import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { FormBanner } from '@/components/auth/FormAlerts'
import { buildCaptchaPayload, isAuthCaptchaEnabled, validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const captchaEnabled = isAuthCaptchaEnabled()
  const [token, setToken] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [captchaFieldError, setCaptchaFieldError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setCaptchaFieldError('')
    const captchaErr = validateCaptchaBeforeSubmit(captchaEnabled, captchaOn, captchaCode)
    if (captchaErr) {
      setBusy(false)
      if (captchaErr.includes('Enter the')) setCaptchaFieldError(captchaErr)
      else setError(captchaErr)
      return
    }
    try {
      const captcha = buildCaptchaPayload(captchaEnabled, captchaOn, captchaId, captchaCode)
      await authFetch('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({
          token,
          new_password: password,
          confirm_password: confirm,
          ...(captcha ?? {}),
        }),
      })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPanel title="Set new password" subtitle="Use the token from your administrator" footer={<AuthFooterLinks />}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <FormBanner message={error} />
        <label className="block text-base font-medium">
          Reset token
          <input
            required
            className="field-input qrp-auth-input mt-1.5 font-mono text-sm"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <label className="block text-base font-medium">
          New password
          <input
            required
            type="password"
            minLength={6}
            autoComplete="new-password"
            className="field-input qrp-auth-input mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="block text-base font-medium">
          Confirm password
          <input
            required
            type="password"
            minLength={6}
            autoComplete="new-password"
            className="field-input qrp-auth-input mt-1.5"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <AuthCaptchaBlock
          captchaCode={captchaCode}
          onCodeChange={setCaptchaCode}
          onChallenge={setCaptchaId}
          onAvailability={setCaptchaOn}
          fieldError={captchaFieldError}
        />
        <button type="submit" disabled={busy} className="btn-primary qrp-auth-submit w-full">
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
      <Link className="mt-4 inline-block text-base font-medium text-primary hover:underline" to="/login">
        Back to sign in
      </Link>
    </AuthPanel>
  )
}