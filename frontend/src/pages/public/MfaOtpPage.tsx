import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { authFetch } from '@/api/qre'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { CaptchaField } from '@/components/auth/CaptchaField'
import { FieldAlert, FormBanner, mapApiFieldErrors } from '@/components/auth/FormAlerts'
import { notifySuccess } from '@/lib/toast'

const captchaEnabled = import.meta.env.VITE_QRE_CAPTCHA === '1'

/**
 * MFA / TOTP step after password when identity returns MFA_REQUIRED.
 * Lab often skips this (mfa_required=false); page stays ready for deployments that enable it.
 */
export function MfaOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const challengeId = (location.state as { challenge_id?: string } | null)?.challenge_id || ''

  const [code, setCode] = useState('')
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
    if (!/^\d{6}$/.test(code.trim())) {
      setFields({ otp: 'Enter the 6-digit code from your authenticator' })
      setBusy(false)
      return
    }
    try {
      const body: Record<string, string> = { otp: code.trim() }
      if (challengeId) body.challenge_id = challengeId
      if (captchaEnabled && captchaOn && captchaId && captchaCode) {
        body.captcha_id = captchaId
        body.captcha_code = captchaCode
      }
      await authFetch('/auth/mfa/verify', { method: 'POST', body: JSON.stringify(body) })
      notifySuccess('Verified', { toastId: 'mfa-ok' })
      navigate('/qrp', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapApiFieldErrors(err.fieldErrors)
        setFields(mapped)
        setBanner(mapped.otp ? '' : err.detail || 'Verification failed')
      } else {
        setBanner(err instanceof Error ? err.message : 'Verification failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPanel
      title="Verify with authenticator"
      subtitle="Enter the 6-digit code from your MFA app"
      footer={
        <Link className="font-medium text-primary hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormBanner message={banner} />
        <label className="block text-sm font-medium">
          Authentication code
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            className="field-input tracking-[0.35em] tabular-nums"
            value={code}
            aria-invalid={Boolean(fields.otp)}
            aria-describedby={fields.otp ? 'otp-err' : undefined}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <FieldAlert id="otp-err" message={fields.otp} />
        </label>
        {captchaEnabled ? (
          <CaptchaField
            value={captchaCode}
            onChange={setCaptchaCode}
            onChallenge={setCaptchaId}
            onAvailability={setCaptchaOn}
          />
        ) : null}
        <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full">
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </AuthPanel>
  )
}
