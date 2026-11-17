import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { useAuth } from '@/auth/hooks'
import { formatPrincipalId, formatRole } from '@/lib/display'
import { Card, PanelHeader } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'

/** Password/MFA/session flows ship on the QRP identity API in later slices. */
export function AccountSecurity() {
  const { user } = useAuth()
  const caps = useQuery({ queryKey: authCapabilitiesKey, queryFn: fetchAuthCapabilities, staleTime: 60_000 })
  return (
    <Card className="space-y-2 text-sm">
      <PanelHeader title="Account" />
      {user ? (
        <>
          <p>
            Signed in as{' '}
            <span className="font-medium">
              {formatPrincipalId(user.principal_id, user.roles[0])}
              {user.roles.length ? ` · ${user.roles.map((r) => formatRole(r)).join(', ')}` : ''}
            </span>
          </p>
          {caps.data ? (
            <dl className="grid gap-2 rounded-lg border border-border/70 bg-muted/15 p-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">MFA</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  <StatusBadge
                    tone={caps.data.mfa_verification_available ? 'success' : 'neutral'}
                    label={caps.data.mfa_verification_available ? 'Verification on' : 'Verification off'}
                  />
                  {caps.data.mfa_required ? <StatusBadge tone="warning" label="Required in config" /> : null}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Password reset</dt>
                <dd className="mt-1">
                  <StatusBadge
                    tone={caps.data.password_self_service ? 'success' : 'neutral'}
                    label={caps.data.password_self_service ? 'Self-service on' : 'Administrator only'}
                  />
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground">Loading deployment capabilities…</p>
          )}
          <p className="text-muted-foreground">
            Profile and role assignment use the QRP identity API. Options above reflect live server configuration, not UI placeholders.
          </p>
          <p className="flex flex-wrap gap-3">
            <Link className="font-medium text-primary hover:underline" to="/qrp/profile">
              Profile
            </Link>
            <Link className="font-medium text-primary hover:underline" to="/qrp/admin/users">
              Users & roles
            </Link>
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">No session.</p>
      )}
    </Card>
  )
}
