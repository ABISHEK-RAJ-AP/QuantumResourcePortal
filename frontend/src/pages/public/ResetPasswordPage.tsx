import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { ApiError } from '@/api/client'
import { authFetch } from '@/api/qre'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { CaptchaField } from '@/components/auth/CaptchaField'
import { FieldAlert, FormBanner, mapApiFieldErrors } from '@/components/auth/FormAlerts'
import { notifySuccess } from '@/lib/toast'

const captchaEnabled = import.meta.env.VITE_QRE_CAPTCHA === '1'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [token, setToken] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setBanner('')
    setFields({})
    const next: Record<string, string> = {}
    if (!token.trim()) next.token = 'Reset token is required'
    if (password.length < 8) next.new_password = 'Use at least 8 characters'
    if (password !== confirm) next.confirm_password = 'Passwords do not match'
    if (captchaEnabled && captchaOn && !captchaCode.trim()) next.captcha_code = 'Enter the characters shown'
    if (Object.keys(next).length) {
      setFields(next)
      setBusy(false)
      return
    }
    try {
      const body: Record<string, string> = {
        token: token.trim(),
        new_password: password,
        confirm_password: confirm,
      }
      if (captchaEnabled && captchaOn && captchaId && captchaCode) {
        body.captcha_id = captchaId
        body.captcha_code = captchaCode
      }
      await authFetch('/auth/password/reset', { method: 'POST', body: JSON.stringify(body) })
      notifySuccess('Password updated', { toastId: 'pw-reset' })
      navigate('/login', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapApiFieldErrors(err.fieldErrors)
        setFields(mapped)
        setBanner(Object.keys(mapped).length ? '' : err.detail || 'Reset failed')
      } else {
        setBanner(err instanceof Error ? err.message : 'Reset failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPanel
      title="Set new password"
      subtitle="Paste the token from your reset email"
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormBanner message={banner} />
        <label className="block text-sm font-medium">
          Reset token
          <input
            required
            className="field-input"
            value={token}
            aria-invalid={Boolean(fields.token)}
            onChange={(e) => setToken(e.target.value)}
          />
          <FieldAlert message={fields.token} />
        </label>
        <label className="block text-sm font-medium">
          New password
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            className="field-input"
            value={password}
            aria-invalid={Boolean(fields.new_password)}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldAlert message={fields.new_password} />
        </label>
        <label className="block text-sm font-medium">
          Confirm password
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            className="field-input"
            value={confirm}
            aria-invalid={Boolean(fields.confirm_password)}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FieldAlert message={fields.confirm_password} />
        </label>
        {captchaEnabled ? (
          <div>
            <CaptchaField
              value={captchaCode}
              onChange={setCaptchaCode}
              onChallenge={setCaptchaId}
              onAvailability={setCaptchaOn}
            />
            <FieldAlert message={fields.captcha_code} />
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthPanel>
  )
}
