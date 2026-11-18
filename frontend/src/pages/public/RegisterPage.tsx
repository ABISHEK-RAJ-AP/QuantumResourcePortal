import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { FormBanner } from '@/components/auth/FormAlerts'
import { validateCaptchaBeforeSubmit } from '@/lib/authCaptcha'
import { useAuthCaptchaRequired } from '@/hooks/useAuthCaptchaRequired'

/**
 * Request-access page (RBAC-6). Self-service registration is disabled; captcha gates the path to sign-in.
 */
export function RegisterPage() {
  const navigate = useNavigate()
  const captchaEnabled = useAuthCaptchaRequired()
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaOn, setCaptchaOn] = useState(false)
  const [banner, setBanner] = useState('')
  const [fieldError, setFieldError] = useState('')

  function continueToSignIn() {
    setBanner('')
    setFieldError('')
    const err = validateCaptchaBeforeSubmit(captchaEnabled, captchaOn, captchaCode)
    if (err) {
      if (err.includes('Enter the')) setFieldError(err)
      else setBanner(err)
      return
    }
    navigate('/login', { state: { accessRequest: true, captcha_id: captchaId } })
  }

  return (
    <AuthPanel
      title="Request access"
      subtitle="Accounts are created by a platform administrator"
      footer={<AuthFooterLinks showForgot />}
    >
      <p className="text-base leading-relaxed text-muted-foreground">
        Self-service sign-up is disabled on this deployment. Complete verification below, then sign in once an admin has
        created your account.
      </p>
      <FormBanner message={banner} />
      <AuthCaptchaBlock
        captchaCode={captchaCode}
        onCodeChange={setCaptchaCode}
        onChallenge={setCaptchaId}
        onAvailability={setCaptchaOn}
        fieldError={fieldError}
      />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn-primary qrp-auth-submit auth-cta flex-1" onClick={continueToSignIn}>
          Continue to sign in
        </button>
        <Link
          className="btn-secondary qrp-auth-submit auth-cta inline-flex flex-1 items-center justify-center"
          to="/login"
        >
          Back to sign in
        </Link>
      </div>
    </AuthPanel>
  )
}