/** Permission catalogue (RBAC-6, screen C): read-only; shows each permission and the roles using it. */
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import * as rbac from '@/api/rbac'
import { Card, EmptyState, Notice, Page } from '@/components/layout/Page'

export function PermissionsPage() {
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: rbac.listPermissions })
  const [query, setQuery] = useState('')

  const byModule = useMemo(() => {
    const q = query.trim().toLowerCase()
    const groups: Record<string, rbac.Permission[]> = {}
    for (const p of permissions.data ?? []) {
      if (q && !p.code.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) continue
      ;(groups[p.module] ??= []).push(p)
    }
    return groups
  }, [permissions.data, query])

  return (
    <Page
      title="Permissions"
      description="The permission catalogue is read-only. Grant permissions by editing a role."
    >
      <Card>
        <input
          className="field-input max-w-sm"
          placeholder="Search permissions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>
      {permissions.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius)] bg-muted" />
          ))}
          <span className="sr-only">Loading permissions</span>
        </div>
      ) : Object.keys(byModule).length === 0 ? (
        <EmptyState title="No permissions" body="Nothing matches your search." />
      ) : (
        Object.entries(byModule).map(([module, perms]) => (
          <Card key={module} className="space-y-2">
            <h2 className="label-quiet">
              {module}
            </h2>
            <table className="w-full text-left text-sm">
              <tbody>
                {perms.map((p) => (
                  <tr key={p.code} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{p.code}</td>
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 pr-3">
                      {p.is_privileged && (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                          privileged
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {(p.roles ?? []).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))
      )}
      <PermissionNote />
    </Page>
  )
}

function PermissionNote() {
  // Surface, once, that the catalogue cannot be edited (even for admins) — plan §4.
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <Notice tone="info">
      The permission catalogue is fixed by the platform. Roles decide who holds each permission.{' '}
      <button type="button" className="font-medium underline" onClick={() => setDismissed(true)}>
        Got it
      </button>
    </Notice>
  )
}
