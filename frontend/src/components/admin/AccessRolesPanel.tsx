import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

import { ApiError } from '@/api/client'
import * as rbac from '@/api/rbac'
import { PermissionGate } from '@/auth/PermissionGate'
import { DataTable } from '@/components/data/DataTable'
import { DataState } from '@/components/data/DataState'
import { Card, Notice } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

export function AccessRolesPanel() {
  const client = useQueryClient()
  const { openConfirm, confirmDialog } = useConfirmDialog()
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

  const list = roles.data ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">System roles are fixed; create organization roles from the catalogue.</p>
        <PermissionGate permission="role:create">
          <Link to="/qrp/admin/roles/new" className="btn-primary text-sm">
            New role
          </Link>
        </PermissionGate>
      </div>
      {error ? <Notice tone="critical">{error}</Notice> : null}
      {confirmDialog}
      <Card>
        <DataState
          pending={roles.isPending}
          error={roles.error ?? undefined}
          onRetry={roles.isError ? () => void roles.refetch() : undefined}
          empty={list.length === 0}
          emptyTitle="No roles"
          emptyBody="Create a role to get started."
          compactLoading
        >
          <DataTable
            caption="Roles"
            rows={list}
            pageSize={20}
            columns={[
              {
                key: 'name',
                label: 'Role',
                sortable: true,
                render: (r) => (
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {r.name}
                      {r.is_system ? (
                        <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          SYSTEM
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                  </span>
                ),
              },
              { key: 'assignable_scope', label: 'Scope', sortable: true },
              { key: 'user_count', label: 'Users', sortable: true },
              { key: 'permission_count', label: 'Permissions', sortable: true },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                render: (r) => <StatusBadge tone={r.status === 'ACTIVE' ? 'success' : 'warning'} label={r.status} />,
              },
              {
                key: 'role_id',
                label: 'Actions',
                render: (r) => (
                  <span className="flex flex-wrap gap-2">
                    <Link to={`/qrp/admin/roles/${r.role_id}`} className="fs-link text-xs font-medium">
                      {r.is_system ? 'View' : 'Edit'}
                    </Link>
                    {!r.is_system ? (
                      <PermissionGate permission="role:update">
                        <button
                          type="button"
                          className="fs-link text-xs font-medium"
                          onClick={() => toggle.mutate({ id: r.role_id, active: r.status !== 'ACTIVE' })}
                        >
                          {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </PermissionGate>
                    ) : null}
                    {!r.is_system ? (
                      <PermissionGate permission="role:delete">
                        <button
                          type="button"
                          className="text-xs font-medium text-critical hover:underline"
                          onClick={() => {
                            openConfirm({
                              title: 'Delete role',
                              body: `Delete role ${r.code}? Assignments may need cleanup.`,
                              confirmLabel: 'Delete',
                              danger: true,
                              onConfirm: () => del.mutate(r.role_id),
                            })
                          }}
                        >
                          Delete
                        </button>
                      </PermissionGate>
                    ) : null}
                  </span>
                ),
              },
            ]}
          />
        </DataState>
      </Card>
    </div>
  )
}