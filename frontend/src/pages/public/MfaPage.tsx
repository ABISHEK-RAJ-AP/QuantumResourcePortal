import { Link, useLocation } from 'react-router'

import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'

export function MfaPage() {
  const location = useLocation()
  const challengeId = (location.state as { challenge_id?: string; from?: string } | null)?.challenge_id

  return (
    <AuthPanel
      title="Additional verification"
      subtitle="MFA after password sign-in"
      footer={<AuthFooterLinks />}
    >
      <p className="text-base leading-relaxed text-muted-foreground">
        Your account passed the password check. When MFA is enforced in your environment, use the channel your
        administrator configured.
      </p>
      {challengeId ? (
        <p className="mt-3 font-mono text-sm text-muted-foreground">Challenge ref: {challengeId.slice(0, 12)}…</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/login" className="btn-primary qrp-auth-submit px-5">
          Back to sign in
        </Link>
        <Link to="/system/status" className="btn-secondary qrp-auth-submit px-5">
          Platform status
        </Link>
      </div>
    </AuthPanel>
  )
}