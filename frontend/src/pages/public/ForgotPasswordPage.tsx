import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { ApiError } from '@/api/client'
import { authFetch } from '@/api/qre'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { CaptchaField } from '@/components/auth/CaptchaField'
import { FieldAlert, FormBanner, mapApiFieldErrors } from '@/components/auth/FormAlerts'

const captchaEnabled = import.meta.env.VITE_QRE_CAPTCHA === '1'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setBanner('')
    setFields({})
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFields({ email: 'Enter a valid email address' })
      setBusy(false)
      return
    }
    if (captchaEnabled && captchaOn && !captchaCode.trim()) {
      setFields({ captcha_code: 'Enter the characters shown' })
      setBusy(false)
      return
    }
    try {
      const body: Record<string, string> = { email: email.trim() }
      if (captchaEnabled && captchaOn && captchaId && captchaCode) {
        body.captcha_id = captchaId
        body.captcha_code = captchaCode
      }
      await authFetch('/auth/password/forgot', { method: 'POST', body: JSON.stringify(body) })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.status === 501) {
          setBanner(
            'Self-service email reset is not enabled on this deployment. Ask a platform administrator.',
          )
        } else {
          const mapped = mapApiFieldErrors(err.fieldErrors)
          setFields(mapped)
          setBanner(Object.keys(mapped).length ? '' : err.detail)
        }
      } else {
        setBanner(
          'Self-service email reset is not enabled on this deployment. Ask a platform administrator.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPanel
      title="Reset password"
      subtitle="We email a reset link when self-service is enabled"
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      {done ? (
        <FormBanner
          tone="success"
          message="If that address is registered, a reset link is on its way. Check your inbox."
        />
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <FormBanner message={banner} tone={banner.includes('administrator') ? 'warning' : 'critical'} />
          <label className="block text-sm font-medium">
            Work email
            <input
              required
              type="email"
              autoComplete="email"
              className="field-input"
              value={email}
              aria-invalid={Boolean(fields.email)}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldAlert message={fields.email} />
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
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthPanel>
  )
}
