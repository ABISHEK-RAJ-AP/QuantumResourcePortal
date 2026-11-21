import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as rbac from '@/api/rbac'
import { Card, PanelHeader } from '@/components/layout/Page'
import { DataState } from '@/components/data/DataState'
import { moduleLabel } from '@/lib/rbacDisplay'

/** Cert Studio–style module × role matrix (derived from permission catalogue). */
export function AccessRoleMatrix() {
  const roles = useQuery({ queryKey: ['roles'], queryFn: rbac.listRoles })
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: rbac.listPermissions })

  const { modules, rows } = useMemo(() => {
    const perms = permissions.data ?? []
    const activeRoles = (roles.data ?? []).filter((r) => r.status === 'ACTIVE')
    const modules = [...new Set(perms.map((p) => p.module))].sort()
    const roleModules = new Map<string, Set<string>>()
    for (const p of perms) {
      for (const code of p.roles ?? []) {
        const set = roleModules.get(code) ?? new Set<string>()
        set.add(p.module)
        roleModules.set(code, set)
      }
    }
    const rows = activeRoles.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      modules: roleModules.get(r.code) ?? new Set<string>(),
    }))
    return { modules, rows }
  }, [permissions.data, roles.data])

  const pending = roles.isPending || permissions.isPending
  const error = roles.error || permissions.error

  return (
    <Card className="space-y-3">
      <PanelHeader
        title="Role capability matrix"
        tip="Module coverage per active role. Assign roles from the Users tab."
      />
      <DataState
        pending={pending}
        error={error ?? undefined}
        onRetry={
          roles.isError || permissions.isError
            ? () => {
                void roles.refetch()
                void permissions.refetch()
              }
            : undefined
        }
        empty={!rows.length || !modules.length}
        emptyTitle="No matrix data"
        emptyBody="Load roles and the permission catalogue to see coverage."
        compactLoading
      >
        <div className="qrp-access__matrix-scroll">
          <table className="qrp-access__matrix">
            <thead>
              <tr>
                <th scope="col">Role</th>
                {modules.map((m) => (
                  <th key={m} scope="col" title={m}>
                    {moduleLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <th scope="row">
                    <div className="qrp-access__matrix-role">{r.name}</div>
                    <div className="qrp-access__matrix-sub font-mono text-[11px]">{r.code}</div>
                  </th>
                  {modules.map((m) => {
                    const on = r.modules.has(m)
                    return (
                      <td key={m} className="text-center">
                        <span className={on ? 'qrp-access__mark is-on' : 'qrp-access__mark'} aria-hidden>
                          {on ? '✓' : '—'}
                        </span>
                        <span className="sr-only">
                          {r.code} · {m}: {on ? 'yes' : 'no'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </Card>
  )
}