/** User effective access — Cert Studio capability cards + technical scopes. */
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'

import * as rbac from '@/api/rbac'
import { Card, Notice, Page, RelatedNav } from '@/components/layout/Page'
import { moduleLabel } from '@/lib/rbacDisplay'
import { cn } from '@/lib/utils'

import '@/styles/access-workspace.css'

export function UserPermissionsPage() {
  const { userId = '' } = useParams()
  const eff = useQuery({
    queryKey: ['effective', userId],
    queryFn: () => rbac.getUserEffectivePermissions(userId),
    enabled: !!userId,
  })

  const byModule = useMemo(() => {
    const groups: Record<string, rbac.Grant[]> = {}
    for (const g of eff.data?.grants ?? []) (groups[g.permission.split(':')[0]] ??= []).push(g)
    return groups
  }, [eff.data])

  const modules = Object.keys(byModule).sort()
  const fullAccess = (eff.data?.permissions ?? []).some((p) => p.includes('*'))

  const capabilityCards = useMemo(() => {
    const known = new Set(modules)
    const extras = (eff.data?.permissions ?? [])
      .map((p) => p.split(':')[0])
      .filter((m) => m && !known.has(m))
    const all = [...new Set([...modules, ...extras])].sort()
    return all.map((module) => ({
      id: module,
      label: moduleLabel(module),
      granted: known.has(module) || fullAccess,
      count: (byModule[module] ?? []).length,
    }))
  }, [byModule, eff.data?.permissions, fullAccess, modules])

  return (
    <Page
      crumbs={[
        { label: 'Organization', to: '/qrp/organization' },
        { label: 'People & access', to: '/qrp/admin/users' },
        { label: eff.data?.username ?? 'User' },
      ]}
      title={eff.data ? `Access · ${eff.data.username}` : 'User access'}
      description="Effective organization capabilities from active role assignments (org, project, or provider scope)."
      actions={
        <Link to="/qrp/admin/users" className="btn-ghost text-sm">
          Back to directory
        </Link>
      }
    >
      {eff.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : eff.isError ? (
        <Notice tone="critical">Could not load this user.</Notice>
      ) : (eff.data?.permissions ?? []).length === 0 ? (
        <Notice tone="warning">No permissions — assign a role from the user directory.</Notice>
      ) : (
        <div className="qrp-access max-w-3xl space-y-4">
          <Card>
            <header className="mb-3">
              <h2 className="text-base font-semibold">Capability areas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                High-level modules this principal can use. Open technical scopes for permission codes.
              </p>
            </header>
            {fullAccess ? (
              <p className="text-sm text-muted-foreground">Full platform access — all capability areas enabled.</p>
            ) : (
              <ul className="qrp-access__caps" aria-label="Capability areas">
                {capabilityCards.map((cap) => (
                  <li key={cap.id} className={cn('qrp-access__cap', cap.granted ? 'is-on' : 'is-off')}>
                    <span className="qrp-access__cap-status" aria-hidden>
                      {cap.granted ? <Check className="size-3.5" strokeWidth={3} /> : '—'}
                    </span>
                    <div className="qrp-access__cap-body">
                      <strong>{cap.label}</strong>
                      <span>
                        {cap.granted
                          ? cap.count
                            ? `${cap.count} permission${cap.count === 1 ? '' : 's'} in scope`
                            : 'Included for assigned roles'
                          : 'Not included'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!fullAccess && modules.length > 0 ? (
            <details className="qrp-access__scopes">
              <summary>
                Technical scopes
                <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                  {(eff.data?.permissions ?? []).length}
                </span>
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {modules.map((module) => (
                  <div key={module}>
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {moduleLabel(module)}
                    </h3>
                    <ul className="mt-1.5 space-y-0.5 font-mono text-xs">
                      {(byModule[module] ?? []).map((g) => (
                        <li key={g.permission + g.scope_type + String(g.scope_id)}>
                          {g.permission}
                          {g.scope_type !== 'TENANT' ? (
                            <span className="text-muted-foreground"> · {g.scope_type.toLowerCase()}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
      <RelatedNav
        items={[
          { to: '/qrp/admin/users', label: 'People & access' },
          { to: '/qrp/organization', label: 'Organization hub' },
          { to: '/qrp/audit', label: 'Audit trail' },
        ]}
      />
    </Page>
  )
}
