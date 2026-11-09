/** Current-user profile (RBAC-6, screen G): identity, roles, and effective permissions by module. */
import { useMemo } from 'react'

import { Card, Page } from '@/components/layout/Page'
import { useAuth } from '@/auth/hooks'

export function ProfilePage() {
  const { user, permissions, roles } = useAuth()

  const byModule = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const code of [...permissions].sort()) {
      const module = code.split(':')[0]
      ;(groups[module] ??= []).push(code)
    }
    return groups
  }, [permissions])

  if (!user) return null

  return (
    <Page eyebrow="Account" title="My profile" description="Your identity, roles and effective permissions.">
      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Identity</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">User</dt>
            <dd className="mt-1 font-mono">{user.principal_id}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Tenant</dt>
            <dd className="mt-1 font-mono">{user.tenant_id}</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Roles</h2>
        {roles.size === 0 ? (
          <p className="text-muted-foreground">No roles assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...roles].sort().map((r) => (
              <span key={r} className="rounded-full border border-border bg-muted px-2.5 py-1 font-mono text-xs">
                {r}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3 text-sm">
        <h2 className="text-base font-semibold">Effective permissions ({permissions.size})</h2>
        {Object.keys(byModule).length === 0 ? (
          <p className="text-muted-foreground">No permissions.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(byModule).map(([module, codes]) => (
              <div key={module}>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {module}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {codes.map((c) => (
                    <li key={c} className="font-mono text-xs">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  )
}
