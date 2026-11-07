/** User permission view (RBAC-6, screen E): a user's effective permissions and scopes. */
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'

import * as rbac from '@/api/rbac'
import { Card, Notice, Page } from '@/components/layout/Page'

export function UserPermissionsPage() {
  const { userId = '' } = useParams()
  const eff = useQuery({
    queryKey: ['effective', userId],
    queryFn: () => rbac.getUserEffectivePermissions(userId),
  })

  const byModule = useMemo(() => {
    const groups: Record<string, rbac.Grant[]> = {}
    for (const g of eff.data?.grants ?? []) (groups[g.permission.split(':')[0]] ??= []).push(g)
    return groups
  }, [eff.data])

  return (
    <Page
      eyebrow="Administration"
      title={eff.data ? `Permissions · ${eff.data.username}` : 'User permissions'}
      description="Effective permissions resolved from the user's active role assignments."
      actions={
        <Link to="/qrp/admin/users" className="btn-ghost text-sm">
          Back to users
        </Link>
      }
    >
      {eff.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : eff.isError ? (
        <Notice tone="critical">Could not load this user.</Notice>
      ) : (eff.data?.permissions ?? []).length === 0 ? (
        <Notice tone="info">This user has no permissions (no active roles).</Notice>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byModule).map(([module, grants]) => (
            <Card key={module} className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {module}
              </p>
              <ul className="space-y-0.5">
                {grants.map((g) => (
                  <li key={g.permission + g.scope_type + g.scope_id} className="font-mono text-xs">
                    {g.permission}
                    {g.scope_type !== 'TENANT' && (
                      <span className="text-muted-foreground"> · {g.scope_type.toLowerCase()}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}
