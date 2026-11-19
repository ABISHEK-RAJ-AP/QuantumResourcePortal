import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ApiError } from '@/api/client'
import * as rbac from '@/api/rbac'
import { PermissionGate } from '@/auth/PermissionGate'
import { DataTable } from '@/components/data/DataTable'
import { DataState } from '@/components/data/DataState'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { Card, Notice } from '@/components/layout/Page'
import { parseForm } from '@/lib/validation/parseForm'
import { membershipGrantSchema } from '@/lib/validation/schemas'
import { cn } from '@/lib/utils'
import { formatApiError } from '@/lib/apiMessage'
import { StatusBadge } from '@/components/status/StatusBadge'

export function AccessUsersPanel() {
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: rbac.listUsers })
  const memberships = useQuery({ queryKey: ['memberships'], queryFn: () => rbac.listMemberships() })
  const roles = useQuery({ queryKey: ['roles'], queryFn: rbac.listRoles })
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const byUser = useMemo(() => {
    const map: Record<string, rbac.Membership[]> = {}
    for (const m of memberships.data ?? []) (map[m.principal_id] ??= []).push(m)
    return map
  }, [memberships.data])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = users.data ?? []
    if (!q) return list
    return list.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.display_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q),
    )
  }, [users.data, search])

  const revoke = useMutation({
    mutationFn: (membershipId: string) => rbac.revokeMembership(membershipId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['memberships'] })
      void client.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (e) => setError(e instanceof ApiError ? e.detail : 'Could not revoke role'),
  })

  return (
    <div className="space-y-4">
      {error ? <Notice tone="critical">{error}</Notice> : null}
      {memberships.isError ? (
        <Notice tone="warning">
          Could not load assignments: {formatApiError(memberships.error)}.
          <button type="button" className="btn-ghost ms-2 text-sm" onClick={() => void memberships.refetch()}>
            Retry
          </button>
        </Notice>
      ) : null}

      <PermissionGate permission="membership:admin">
        <GrantForm
          users={users.data ?? []}
          roles={roles.isError ? [] : (roles.data ?? [])}
          onError={setError}
          onDone={() => {
            void client.invalidateQueries({ queryKey: ['memberships'] })
            void client.invalidateQueries({ queryKey: ['roles'] })
          }}
        />
      </PermissionGate>

      <Card>
        <div className="qrp-access__toolbar">
          <label className="qrp-access__search block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Search</span>
            <input
              type="search"
              className="field-input w-full"
              placeholder="Name, username, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span className="qrp-access__count" role="status">
            {visible.length} of {(users.data ?? []).length} users
          </span>
        </div>
        <DataState
          pending={users.isPending}
          error={users.error ?? undefined}
          onRetry={users.isError ? () => void users.refetch() : undefined}
          empty={(users.data ?? []).length === 0}
          emptyTitle="No members"
          emptyBody="Add organization members, then grant roles (invite-by-email arrives in a later phase)."
          compactLoading
        >
          <DataTable
            caption="Organization member directory"
            rows={visible}
            pageSize={20}
            columns={[
              {
                key: 'username',
                label: 'User',
                sortable: true,
                render: (u) => (
                  <span className="flex flex-col">
                    <span className="font-medium">{u.username}</span>
                    <span className="text-xs text-muted-foreground">{u.display_name}</span>
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                render: (u) => <StatusBadge tone={u.status === 'ACTIVE' ? 'success' : 'warning'} label={u.status} />,
              },
              {
                key: 'user_id',
                label: 'Roles',
                render: (u) =>
                  (byUser[u.user_id] ?? []).length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {(byUser[u.user_id] ?? []).map((m) => (
                        <li key={m.membership_id} className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium">
                            {m.role}
                            {m.scope_type !== 'TENANT' ? (
                              <span className="text-muted-foreground"> · {m.scope_type.toLowerCase()}</span>
                            ) : (
                              <span className="text-muted-foreground"> · organization</span>
                            )}
                          </span>
                          <PermissionGate permission="membership:admin">
                            <button
                              type="button"
                              className="text-xs text-critical hover:underline"
                              onClick={() => revoke.mutate(m.membership_id)}
                            >
                              Revoke
                            </button>
                          </PermissionGate>
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                key: 'email',
                label: '',
                render: (u) => (
                  <Link to={`/qrp/admin/users/${u.user_id}`} className="fs-link text-sm font-medium">
                    Access
                  </Link>
                ),
              },
            ]}
          />
        </DataState>
      </Card>
    </div>
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
  const [open, setOpen] = useState(false)
  const [principalId, setPrincipalId] = useState('')
  const [roleCode, setRoleCode] = useState('')
  const [scopeId, setScopeId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
      setOpen(false)
      onDone()
    },
    onError: (e) => onError(e instanceof ApiError ? e.detail : 'Could not grant role'),
  })

  return (
    <Card className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Assign role
        <span className="text-xs font-normal text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <form
          className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onError('')
            setFieldErrors({})
            const parsed = parseForm(membershipGrantSchema, {
              principal_id: principalId,
              role_code: roleCode,
              scope_type: role?.assignable_scope ?? 'TENANT',
              scope_id: scopeId,
            })
            if (!parsed.ok) {
              setFieldErrors(parsed.fieldErrors)
              if (parsed.formError) onError(parsed.formError)
              return
            }
            grant.mutate()
          }}
        >
          <FormField label="User" htmlFor="grant-user" error={fieldErrors.principal_id}>
            <select
              id="grant-user"
              className={cn('field-input w-full', fieldErrorClass(Boolean(fieldErrors.principal_id)))}
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
            >
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.username}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Role" htmlFor="grant-role" error={fieldErrors.role_code}>
            <select
              id="grant-role"
              className={cn('field-input w-full', fieldErrorClass(Boolean(fieldErrors.role_code)))}
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
            >
              <option value="">Select…</option>
              {roles
                .filter((r) => r.status === 'ACTIVE')
                .map((r) => (
                  <option key={r.role_id} value={r.code}>
                    {r.code} ({r.assignable_scope})
                  </option>
                ))}
            </select>
          </FormField>
          {needsScope ? (
            <FormField
              className="sm:col-span-2"
              label={role?.assignable_scope === 'PROJECT' ? 'Project id' : 'Provider id'}
              htmlFor="grant-scope"
              error={fieldErrors.scope_id}
            >
              <input
                id="grant-scope"
                className={cn('field-input font-mono', fieldErrorClass(Boolean(fieldErrors.scope_id)))}
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
              />
            </FormField>
          ) : null}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary text-sm" disabled={grant.isPending}>
              {grant.isPending ? 'Granting…' : 'Grant role'}
            </button>
          </div>
        </form>
      ) : null}
    </Card>
  )
}