import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { authCapabilitiesKey, fetchAuthCapabilities } from '@/api/authCapabilities'
import { useAuth } from '@/auth/hooks'
import { formatPrincipalId, formatRole } from '@/lib/display'
import { Card, PanelHeader } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'

export function AccountSecurity() {
  const { user } = useAuth()
  const caps = useQuery({ queryKey: authCapabilitiesKey, queryFn: fetchAuthCapabilities, staleTime: 60_000 })

  if (!user) {
    return (
      <Card className="text-sm">
        <PanelHeader title="Account" />
        <p className="text-muted-foreground">No session.</p>
      </Card>
    )
  }

  const display = formatPrincipalId(user.principal_id, user.roles[0])
  const role = user.roles.map((r) => formatRole(r)).join(', ')

  return (
    <Card className="space-y-3 text-sm">
      <PanelHeader title="Account" />
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">User</dt>
          <dd className="mt-1 font-medium">{display}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Role</dt>
          <dd className="mt-1 font-medium">{role}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">MFA</dt>
          <dd className="mt-1">
            <StatusBadge
              tone={caps.data?.mfa_verification_available ? 'success' : 'neutral'}
              label={caps.data?.mfa_verification_available ? 'On' : 'Off'}
            />
            {caps.data?.mfa_required ? (
              <StatusBadge tone="warning" label="Required" className="ms-2" />
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Password</dt>
          <dd className="mt-1">
            <StatusBadge
              tone={caps.data?.password_self_service ? 'success' : 'neutral'}
              label={caps.data?.password_self_service ? 'Self-service' : 'Admin only'}
            />
          </dd>
        </div>
      </dl>
      <p className="flex flex-wrap gap-3 border-t border-border pt-3">
        <Link className="font-medium text-primary hover:underline" to="/qrp/profile">
          Profile
        </Link>
        <Link className="font-medium text-primary hover:underline" to="/qrp/admin/users">
          Users & roles
        </Link>
        <Link className="font-medium text-primary hover:underline" to="/qrp/audit">
          Audit trail
        </Link>
        <Link className="font-medium text-primary hover:underline" to="/system/status">
          Platform status
        </Link>
        <Link className="font-medium text-primary hover:underline" to="/legal/privacy">
          Privacy
        </Link>
        <Link className="font-medium text-primary hover:underline" to="/legal/terms">
          Terms
        </Link>
      </p>
    </Card>
  )
}