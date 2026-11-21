import { Link } from 'react-router'

import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'

/** Backend password reset is not enabled (501); no captcha or submit until API ships. */
export function ForgotPasswordPage() {
  return (
    <AuthPanel
      title="Password reset"
      subtitle="Administrator-assisted password reset"
      footer={<AuthFooterLinks showRegister />}
    >
      <p className="cert-auth-prose">
        Self-service password reset is not available on this deployment. Contact your system administrator to request a
        reset. If your administrator issued a reset token, open{' '}
        <Link to="/reset-password" className="fs-link">
          Set new password
        </Link>{' '}
        and follow their instructions.
      </p>
      <Link className="btn-primary qrp-auth-submit auth-cta w-full" to="/login">
        Back to sign in
      </Link>
    </AuthPanel>
  )
}