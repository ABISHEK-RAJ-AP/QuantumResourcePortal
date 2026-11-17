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
      subtitle="Self-service email reset is not enabled in this build"
      footer={<AuthFooterLinks showRegister />}
    >
      <p className="text-base leading-relaxed text-muted-foreground">
        Contact a platform administrator or use the Users screen after sign-in. Complete image verification when
        password self-service is enabled.
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