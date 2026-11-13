/** Role management list (RBAC-6, screen A): roles with counts, status, and create/edit/delete. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { ApiError } from '@/api/client'
import * as rbac from '@/api/rbac'
import { PermissionGate } from '@/auth/PermissionGate'
import { Card, EmptyState, Notice, Page } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'

export function RolesPage() {
  const client = useQueryClient()
  const roles = useQuery({ queryKey: ['roles'], queryFn: rbac.listRoles })
  const [error, setError] = useState('')

  const del = useMutation({
    mutationFn: (roleId: string) => rbac.deleteRole(roleId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['roles'] }),
    onError: (e) => setError(e instanceof ApiError ? e.detail : 'Could not delete role'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => rbac.setRoleActive(id, active),
    onSuccess: () => client.invalidateQueries({ queryKey: ['roles'] }),
    onError: (e) => setError(e instanceof ApiError ? e.detail : 'Could not change status'),
  })

  return (
    <Page
      title="Roles"
      description="System roles are fixed; create tenant roles from the permission catalogue."
      actions={
        <PermissionGate permission="role:create">
          <Link to="/qrp/admin/roles/new" className="btn-primary px-3 py-2 text-sm">
            New role
          </Link>
        </PermissionGate>
      }
    >
      {error && <Notice tone="critical">{error}</Notice>}
      <Card>
        {roles.isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
            <span className="sr-only">Loading roles</span>
          </div>
        ) : roles.isError ? (
          <Notice tone="critical">Could not load roles.</Notice>
        ) : (roles.data ?? []).length === 0 ? (
          <EmptyState title="No roles" body="Create a role to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2.5 font-semibold">Role</th>
                  <th className="px-3 py-2.5 font-semibold">Scope</th>
                  <th className="px-3 py-2.5 font-semibold">Users</th>
                  <th className="px-3 py-2.5 font-semibold">Permissions</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(roles.data ?? []).map((r) => (
                  <tr key={r.role_id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="flex flex-col">
                        <span className="font-medium">
                          {r.name}{' '}
                          {r.is_system && (
                            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              SYSTEM
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{r.assignable_scope}</td>
                    <td className="px-3 py-2.5">{r.user_count ?? 0}</td>
                    <td className="px-3 py-2.5">{r.permission_count ?? 0}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        tone={r.status === 'ACTIVE' ? 'success' : 'warning'}
                        label={r.status}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-2">
                        <Link to={`/qrp/admin/roles/${r.role_id}`} className="btn-ghost text-xs">
                          {r.is_system ? 'View' : 'Edit'}
                        </Link>
                        {!r.is_system && (
                          <PermissionGate permission="role:update">
                            <button
                              type="button"
                              className="btn-ghost text-xs"
                              onClick={() =>
                                toggle.mutate({ id: r.role_id, active: r.status !== 'ACTIVE' })
                              }
                            >
                              {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          </PermissionGate>
                        )}
                        {!r.is_system && (
                          <PermissionGate permission="role:delete">
                            <button
                              type="button"
                              className="btn-ghost text-xs text-critical"
                              onClick={() => {
                                if (window.confirm(`Delete role ${r.code}?`)) del.mutate(r.role_id)
                              }}
                            >
                              Delete
                            </button>
                          </PermissionGate>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  )
}
