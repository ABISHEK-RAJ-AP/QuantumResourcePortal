/**
 * Role create / edit (RBAC-6, screen B). Permissions are grouped by module with select-all /
 * clear-all per module, a live summary, and validation before save. System roles render read-only.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ApiError } from '@/api/client'
import * as rbac from '@/api/rbac'
import { Card, Notice, Page } from '@/components/layout/Page'

const SCOPES = ['TENANT', 'PROJECT', 'PROVIDER'] as const

export function RoleEditorPage() {
  const { roleId } = useParams()
  const isNew = !roleId
  const navigate = useNavigate()
  const client = useQueryClient()

  const permissions = useQuery({ queryKey: ['permissions'], queryFn: rbac.listPermissions })
  const role = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => rbac.getRole(roleId as string),
    enabled: !isNew,
  })

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('PROJECT')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [initialised, setInitialised] = useState(false)

  // Seed form state once the role loads (edit mode).
  if (!isNew && role.data && !initialised) {
    setName(role.data.name)
    setDescription(role.data.description)
    setScope(role.data.assignable_scope)
    setSelected(new Set(role.data.permissions ?? []))
    setInitialised(true)
  }

  const readOnly = !isNew && role.data?.is_system === true

  const byModule = useMemo(() => {
    const groups: Record<string, rbac.Permission[]> = {}
    for (const p of permissions.data ?? []) (groups[p.module] ??= []).push(p)
    return groups
  }, [permissions.data])

  const toggle = (codeStr: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(codeStr)) next.delete(codeStr)
      else next.add(codeStr)
      return next
    })
  const setModule = (module: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of byModule[module] ?? []) {
        if (on) next.add(p.code)
        else next.delete(p.code)
      }
      return next
    })

  const save = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return rbac.createRole({
          code,
          name,
          description,
          assignable_scope: scope,
          permission_codes: [...selected],
        })
      }
      // Edit: update name/description, then replace the permission set.
      await rbac.updateRole(roleId as string, { name, description }, role.data?.row_version)
      const fresh = await rbac.getRole(roleId as string)
      return rbac.setRolePermissions(roleId as string, [...selected], fresh.row_version)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['roles'] })
      navigate('/qrp/admin/roles')
    },
    onError: (e) => setError(e instanceof ApiError ? e.detail : 'Could not save role'),
  })

  const canSave = isNew ? /^[A-Z][A-Z0-9_]{2,31}$/.test(code) && name.trim().length > 0 : name.trim().length > 0

  return (
    <Page
      title={isNew ? 'New role' : readOnly ? 'Role (system)' : 'Edit role'}
      description="Choose a scope and the permissions this role grants, grouped by module."
    >
      {error && <Notice tone="critical">{error}</Notice>}
      {readOnly && (
        <Notice tone="info">This is a system role and cannot be changed. Permissions are shown for reference.</Notice>
      )}

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Code
            <input
              className="field-input font-mono"
              value={isNew ? code : (role.data?.code ?? '')}
              disabled={!isNew}
              placeholder="LAB_LEAD"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <label className="block text-sm font-medium">
            Scope
            <select
              className="field-input"
              value={scope}
              disabled={!isNew || readOnly}
              onChange={(e) => setScope(e.target.value as (typeof SCOPES)[number])}
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Name
            <input className="field-input" value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Description
            <input
              className="field-input"
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Permissions</h2>
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
        </div>
        {permissions.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading permissions…</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {Object.entries(byModule).map(([module, perms]) => {
              const all = perms.every((p) => selected.has(p.code))
              return (
                <div key={module} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="label-quiet">
                      {module}
                    </p>
                    {!readOnly && (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => setModule(module, !all)}
                      >
                        {all ? 'Clear all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {perms.map((p) => (
                      <li key={p.code}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selected.has(p.code)}
                            disabled={readOnly}
                            onChange={() => toggle(p.code)}
                          />
                          <span className="font-mono text-xs">{p.code}</span>
                          {p.is_privileged && (
                            <span className="rounded bg-warning/15 px-1 text-[10px] text-warning">privileged</span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
          </button>
          <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => navigate('/qrp/admin/roles')}>
            Cancel
          </button>
        </div>
      )}
    </Page>
  )
}
