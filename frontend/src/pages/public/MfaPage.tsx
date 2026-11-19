import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { FormBanner } from '@/components/auth/FormAlerts'
import { StatusBadge } from '@/components/status/StatusBadge'
import { safeReturnPath } from '@/lib/safeReturnPath'

export function MfaPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const challengeId = (location.state as { challenge_id?: string; from?: string } | null)?.challenge_id
  const from = safeReturnPath((location.state as { from?: string } | null)?.from)

  const caps = useQuery({ queryKey: authCapabilitiesKey, queryFn: fetchAuthCapabilities })

  const ready = caps.data?.mfa_verification_available === true
  const required = caps.data?.mfa_required === true

  return (
    <AuthPanel
      title="Additional verification"
      footer={<AuthFooterLinks />}
    >
      {caps.isError ? (
        <FormBanner message="Could not load deployment settings." tone="warning" />
      ) : null}

      {!caps.isPending && caps.data && !caps.data.mfa_verification_available ? (
        <FormBanner
          tone="warning"
          message={
            required
              ? 'MFA is required in config but verification is not enabled on this API yet.'
              : 'MFA verification is not enabled; sign-in uses password and session cookies.'
          }
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status</span>
        {ready ? (
          <StatusBadge tone="success" label="Available" />
        ) : (
          <StatusBadge tone="warning" label="Not configured" />
        )}
        {required ? <StatusBadge tone="info" label="Required in config" /> : null}
      </div>

      {challengeId ? (
        <p className="mt-4 font-mono text-xs text-muted-foreground">Challenge {challengeId.slice(0, 12)}…</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary qrp-auth-submit px-5" onClick={() => navigate(from)}>
          Continue to workspace
        </button>
        <Link to="/login" className="fs-link text-sm">
          Back to sign in
        </Link>
      </div>
    </AuthPanel>
  )
}