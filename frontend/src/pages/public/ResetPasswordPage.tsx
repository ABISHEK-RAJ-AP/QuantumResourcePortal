import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { ApiError } from '@/api/client'
import { authFetch } from '@/api/qre'
import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { AuthOutlineField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FormBanner } from '@/components/auth/FormAlerts'
import { buildCaptchaPayload, isAuthCaptchaEnabled, validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { FieldAlert } from '@/components/auth/FormAlerts'
import { parseForm } from '@/lib/validation/parseForm'
import { passwordResetSchema } from '@/lib/validation/schemas'
import { fieldErrorClass } from '@/components/forms/FormField'
import { cn } from '@/lib/utils'

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
  const [fields, setFields] = useState<Record<string, string>>({})

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setCaptchaFieldError('')
    setFields({})
    const parsed = parseForm(passwordResetSchema, { token, password, confirm })
    if (!parsed.ok) {
      setBusy(false)
      setFields(parsed.fieldErrors)
      if (parsed.formError) setError(parsed.formError)
      return
    }
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
      const detail = err instanceof ApiError ? err.detail : err instanceof Error ? err.message : 'Reset failed'
      setError(
        detail.includes('not enabled') || detail.includes('501')
          ? 'Password reset is not enabled on this deployment. Ask an administrator to set your password, then sign in.'
          : detail,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPanel title="Set new password" subtitle="Use the token from your administrator" footer={<AuthFooterLinks />}>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormBanner message={error} />
        <AuthOutlineField label="Reset token" htmlFor="reset-token">
          <input
            id="reset-token"
            required
            className={cn(authOutlineControlClass, fieldErrorClass(Boolean(fields.token)), 'font-mono text-sm')}
            value={token}
            aria-invalid={Boolean(fields.token)}
            onChange={(e) => setToken(e.target.value)}
          />
        </AuthOutlineField>
        <FieldAlert message={fields.token} />
        <AuthOutlineField label="New password" htmlFor="reset-password">
          <input
            id="reset-password"
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            className={cn(authOutlineControlClass, fieldErrorClass(Boolean(fields.password)))}
            value={password}
            aria-invalid={Boolean(fields.password)}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthOutlineField>
        <FieldAlert message={fields.password} />
        <AuthOutlineField label="Confirm password" htmlFor="reset-confirm">
          <input
            id="reset-confirm"
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            className={cn(authOutlineControlClass, fieldErrorClass(Boolean(fields.confirm)))}
            value={confirm}
            aria-invalid={Boolean(fields.confirm)}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </AuthOutlineField>
        <FieldAlert message={fields.confirm} />
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