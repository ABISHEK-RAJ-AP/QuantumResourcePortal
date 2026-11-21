import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import * as rbac from '@/api/rbac'
import { DataState } from '@/components/data/DataState'
import { PaginatedSlice } from '@/components/data/PaginatedSlice'
import { Card, Notice } from '@/components/layout/Page'
import { moduleLabel } from '@/lib/rbacDisplay'

export function AccessCataloguePanel() {
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: rbac.listPermissions })
  const [query, setQuery] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const byModule = useMemo(() => {
    const q = query.trim().toLowerCase()
    const groups: Record<string, rbac.Permission[]> = {}
    for (const p of permissions.data ?? []) {
      if (q && !p.code.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) continue
      ;(groups[p.module] ??= []).push(p)
    }
    return groups
  }, [permissions.data, query])

  const modules = Object.keys(byModule).sort()

  return (
    <div className="space-y-3">
      <Card>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Search permissions</span>
          <input
            className="field-input max-w-md"
            placeholder="Code or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </Card>

      <DataState
        pending={permissions.isPending}
        error={permissions.error ?? undefined}
        onRetry={permissions.isError ? () => void permissions.refetch() : undefined}
        empty={modules.length === 0}
        emptyTitle="No permissions"
        emptyBody="Nothing matches your search."
        compactLoading
      >
        <PaginatedSlice items={modules} pageSize={8}>
          {(pageModules) => (
        <div className="grid gap-3 lg:grid-cols-2">
          {pageModules.map((module) => (
            <Card key={module} className="space-y-2">
              <h3 className="text-sm font-semibold">{moduleLabel(module)}</h3>
              <ul className="space-y-2 text-sm">
                {byModule[module].map((p) => (
                  <li key={p.code} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <p className="font-medium">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Roles: {(p.roles ?? []).join(', ') || '—'}
                      {p.is_privileged ? <span className="ms-2 text-warning">privileged</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
          )}
        </PaginatedSlice>
      </DataState>

      {!dismissed ? (
        <Notice tone="warning">
          Catalogue is platform-fixed — grant access by editing a role.{' '}
          <button type="button" className="font-medium underline" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </Notice>
      ) : null}
    </div>
  )
}