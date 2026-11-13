/**
 * Users & role assignment (RBAC-6, screen D). Lists users, shows their active memberships, and lets
 * an authorised admin grant or revoke roles. Anti-escalation and last-admin rules are enforced by
 * the backend; denied actions surface their reason.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ApiError } from '@/api/client'
import * as rbac from '@/api/rbac'
import { PermissionGate } from '@/auth/PermissionGate'
import { Card, EmptyState, Notice, Page } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'

export function UsersAdminPage() {
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: rbac.listUsers })
  const memberships = useQuery({ queryKey: ['memberships'], queryFn: () => rbac.listMemberships() })
  const roles = useQuery({ queryKey: ['roles'], queryFn: rbac.listRoles })
  const [error, setError] = useState('')

  const byUser = useMemo(() => {
    const map: Record<string, rbac.Membership[]> = {}
    for (const m of memberships.data ?? []) (map[m.principal_id] ??= []).push(m)
    return map
  }, [memberships.data])

  const revoke = useMutation({
    mutationFn: (membershipId: string) => rbac.revokeMembership(membershipId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['memberships'] })
      void client.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e) => setError(e instanceof ApiError ? e.detail : 'Could not revoke role'),
  })

  return (
    <Page
      title="Users & roles"
      description="Assign and revoke roles. Scope and escalation rules are enforced by the server."
    >
      {error && <Notice tone="critical">{error}</Notice>}

      <PermissionGate permission="membership:admin">
        <GrantForm
          users={users.data ?? []}
          roles={roles.data ?? []}
          onError={setError}
          onDone={() => {
            void client.invalidateQueries({ queryKey: ['memberships'] })
            void client.invalidateQueries({ queryKey: ['roles'] })
          }}
        />
      </PermissionGate>

      <Card>
        {users.isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
            <span className="sr-only">Loading users</span>
          </div>
        ) : (users.data ?? []).length === 0 ? (
          <EmptyState title="No users" body="Create users to assign roles." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                  <th className="px-3 py-2.5 font-semibold">User</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Roles</th>
                  <th className="px-3 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u) => (
                  <tr key={u.user_id} className="border-b border-border/70 last:border-0 align-top">
                    <td className="px-3 py-2.5">
                      <span className="flex flex-col">
                        <span className="font-medium">{u.username}</span>
                        <span className="text-xs text-muted-foreground">{u.display_name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={u.status === 'ACTIVE' ? 'success' : 'warning'} label={u.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      {(byUser[u.user_id] ?? []).length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <ul className="space-y-1">
                          {(byUser[u.user_id] ?? []).map((m) => (
                            <li key={m.membership_id} className="flex items-center gap-2">
                              <span className="font-mono text-xs">
                                {m.role}
                                {m.scope_type !== 'TENANT' && (
                                  <span className="text-muted-foreground"> · {m.scope_type.toLowerCase()}</span>
                                )}
                              </span>
                              <PermissionGate permission="membership:admin">
                                <button
                                  type="button"
                                  className="text-xs text-critical hover:underline"
                                  onClick={() => revoke.mutate(m.membership_id)}
                                >
                                  revoke
                                </button>
                              </PermissionGate>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={`/qrp/admin/users/${u.user_id}`} className="btn-ghost text-xs">
                        Permissions
                      </Link>
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

function GrantForm({
  users,
  roles,
  onError,
  onDone,
}: {
  users: rbac.AppUser[]
  roles: rbac.Role[]
  onError: (m: string) => void
  onDone: () => void
}) {
  const [principalId, setPrincipalId] = useState('')
  const [roleCode, setRoleCode] = useState('')
  const [scopeId, setScopeId] = useState('')

  const role = roles.find((r) => r.code === roleCode)
  const needsScope = role && role.assignable_scope !== 'TENANT'

  const grant = useMutation({
    mutationFn: () =>
      rbac.grantMembership({
        principal_id: principalId,
        role_code: roleCode,
        scope_type: role?.assignable_scope ?? 'TENANT',
        scope_id: needsScope ? scopeId : null,
      }),
    onSuccess: () => {
      setPrincipalId('')
      setRoleCode('')
      setScopeId('')
      onDone()
    },
    onError: (e) => onError(e instanceof ApiError ? e.detail : 'Could not grant role'),
  })

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">Assign a role</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          grant.mutate()
        }}
      >
        <label className="text-sm">
          User
          <select className="field-input min-w-48" value={principalId} onChange={(e) => setPrincipalId(e.target.value)} required>
            <option value="">Select…</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.username}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Role
          <select className="field-input min-w-48" value={roleCode} onChange={(e) => setRoleCode(e.target.value)} required>
            <option value="">Select…</option>
            {roles
              .filter((r) => r.status === 'ACTIVE')
              .map((r) => (
                <option key={r.role_id} value={r.code}>
                  {r.code} ({r.assignable_scope})
                </option>
              ))}
          </select>
        </label>
        {needsScope && (
          <label className="text-sm">
            {role?.assignable_scope === 'PROJECT' ? 'Project id' : 'Provider id'}
            <input className="field-input font-mono" value={scopeId} onChange={(e) => setScopeId(e.target.value)} required />
          </label>
        )}
        <button type="submit" className="btn-primary px-3 py-2 text-sm" disabled={grant.isPending}>
          {grant.isPending ? 'Granting…' : 'Grant role'}
        </button>
      </form>
    </Card>
  )
}
