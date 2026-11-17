import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { AuthFooterLinks, AuthPanel } from '@/components/auth/AuthPanel'
import { FormBanner } from '@/components/auth/FormAlerts'
import { StatusBadge } from '@/components/status/StatusBadge'

export function MfaPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const challengeId = (location.state as { challenge_id?: string; from?: string } | null)?.challenge_id
  const from = (location.state as { from?: string } | null)?.from || '/qrp'

  const caps = useQuery({ queryKey: authCapabilitiesKey, queryFn: fetchAuthCapabilities })

  const ready = caps.data?.mfa_verification_available === true
  const required = caps.data?.mfa_required === true

  return (
    <AuthPanel
      title="Additional verification"
      subtitle="Multi-factor authentication"
      footer={<AuthFooterLinks />}
    >
      {caps.isError ? (
        <FormBanner message="Could not load deployment settings. Try again or contact an administrator." tone="warning" />
      ) : null}

      {!caps.isPending && caps.data && !caps.data.mfa_verification_available ? (
        <FormBanner
          tone="warning"
          message={
            required
              ? 'This deployment requires MFA in configuration, but verification is not implemented yet (decision D-13). Set QRE_MFA_REQUIRED=false for lab login, or complete MFA integration before production.'
              : 'MFA verification is not enabled on this deployment. Sign-in uses password and session cookies only.'
          }
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status</span>
        {ready ? (
          <StatusBadge tone="success" label="Verification available" />
        ) : (
          <StatusBadge tone="warning" label="Not configured" />
        )}
        {required ? <StatusBadge tone="info" label="Required in config" /> : null}
      </div>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        When TOTP, OIDC, or SAML MFA is enabled, you will complete a second step here after password sign-in. Until then,
        successful login issues a full session without this page.
      </p>

      {challengeId ? (
        <p className="mt-2 font-mono text-sm text-muted-foreground">Challenge reference: {challengeId.slice(0, 16)}…</p>
      ) : null}

      <ul className="mt-4 list-disc space-y-1 ps-4 text-sm text-muted-foreground">
        <li>Planned methods: TOTP, OIDC, SAML (see Settings → Health → Deployment capabilities).</li>
        <li>User MFA flags in the directory reflect enrollment; enforcement follows the API capability matrix.</li>
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn-primary qrp-auth-submit px-5" onClick={() => navigate(from.startsWith('/') ? from : '/qrp')}>
          Continue to workspace
        </button>
        <Link to="/login" className="btn-secondary qrp-auth-submit px-5">
          Back to sign in
        </Link>
        <Link to="/system/status" className="btn-secondary qrp-auth-submit px-5">
          Platform status
        </Link>
      </div>
    </AuthPanel>
  )
}