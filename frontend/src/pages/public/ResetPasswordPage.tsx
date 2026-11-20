import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { ApiError } from '@/api/client'
import { authFetch } from '@/api/qre'
import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthBackdropSync } from '@/components/auth/authBackdrop'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { AuthOutlineField, AuthPasswordField, authOutlineControlClass } from '@/components/auth/AuthOutlineField'
import { FormBanner } from '@/components/auth/FormAlerts'
import { buildCaptchaPayload, validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'
import { FieldAlert } from '@/components/auth/FormAlerts'
import { parseForm } from '@/lib/validation/parseForm'
import { passwordResetSchema } from '@/lib/validation/schemas'
import { fieldErrorClass } from '@/components/forms/FormField'
import { cn } from '@/lib/utils'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const captchaEnabled = useAuthCaptchaRequired()
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
      <AuthBackdropSync password={password} captchaInput={captchaCode} />
      <form className="cert-auth-form" onSubmit={onSubmit} noValidate>
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
        <AuthPasswordField
          label="New password"
          htmlFor="reset-password"
          autoComplete="new-password"
          value={password}
          invalid={Boolean(fields.password)}
          onChange={setPassword}
        />
        <FieldAlert message={fields.password} />
        <AuthPasswordField
          label="Confirm password"
          htmlFor="reset-confirm"
          autoComplete="new-password"
          value={confirm}
          invalid={Boolean(fields.confirm)}
          onChange={setConfirm}
        />
        <FieldAlert message={fields.confirm} />
        <AuthCaptchaBlock
          captchaCode={captchaCode}
          onCodeChange={setCaptchaCode}
          onChallenge={setCaptchaId}
          onAvailability={setCaptchaOn}
          fieldError={captchaFieldError}
        />
        <button type="submit" disabled={busy} className="btn-primary qrp-auth-submit auth-cta w-full">
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthPanel>
  )
}