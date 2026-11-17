import { Link, useLocation } from 'react-router'

import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'

export function MfaPage() {
  const location = useLocation()
  const challengeId = (location.state as { challenge_id?: string; from?: string } | null)?.challenge_id

  return (
    <AuthPanel
      title="Additional verification"
      subtitle="This deployment can require MFA after password sign-in."
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your account passed the password check but the portal has no MFA challenge UI wired to the identity API yet. If
        MFA is enforced in your environment, use the channel your administrator configured or sign in from an account
        without MFA until enrollment is available.
      </p>
      {challengeId ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Challenge ref: {challengeId.slice(0, 12)}…</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/login" className="btn-primary px-3 py-2 text-sm">
          Back to sign in
        </Link>
        <Link to="/system/status" className="btn-secondary px-3 py-2 text-sm">
          Platform status
        </Link>
      </div>
      <AuthFooterLinks />
    </AuthPanel>
  )
}