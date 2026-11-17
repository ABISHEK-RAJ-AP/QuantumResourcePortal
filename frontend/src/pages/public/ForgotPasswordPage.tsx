import { Link } from 'react-router'

import { AuthCaptchaBlock } from '@/components/auth/AuthCaptchaBlock'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { isAuthCaptchaEnabled } from '@/lib/authCaptcha'
import { useState } from 'react'

/** Self-service reset lands in a later identity slice; captcha shown for parity with login. */
export function ForgotPasswordPage() {
  const captchaEnabled = isAuthCaptchaEnabled()
  const [captchaCode, setCaptchaCode] = useState('')
  const [, setCaptchaId] = useState('')
  const [, setCaptchaOn] = useState(false)

  return (
    <AuthPanel
      title="Password reset"
      subtitle="Administrator-assisted password reset"
      footer={<AuthFooterLinks showRegister />}
    >
      <p className="text-base leading-relaxed text-muted-foreground">
        Self-service email reset is not enabled on this deployment. Contact your platform administrator for a reset token,
        then use Set new password with that token. Image verification below matches the sign-in flow when self-service is
        turned on later.
      </p>
      {captchaEnabled ? (
        <AuthCaptchaBlock
          captchaCode={captchaCode}
          onCodeChange={setCaptchaCode}
          onChallenge={setCaptchaId}
          onAvailability={setCaptchaOn}
        />
      ) : null}
      <Link className="btn-primary qrp-auth-submit mt-6 inline-flex w-full justify-center" to="/login">
        Back to sign in
      </Link>
    </AuthPanel>
  )
}