/**
 * Role create / edit (RBAC-6, screen B). Permissions are grouped by module with select-all /
 * clear-all per module, a live summary, and validation before save. System roles render read-only.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ApiError } from '@/api/client'
import * as rbac from '@/api/rbac'
import { FieldAlert } from '@/components/auth/FormAlerts'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { Card, Notice, Page, RelatedNav } from '@/components/layout/Page'
import { parseForm } from '@/lib/validation/parseForm'
import { roleCreateSchema, roleEditSchema } from '@/lib/validation/schemas'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { cn } from '@/lib/utils'

const SCOPES = ['TENANT', 'PROJECT', 'PROVIDER'] as const
const SCOPE_LABELS: Record<(typeof SCOPES)[number], string> = {
  TENANT: 'Organization',
  PROJECT: 'Research project',
  PROVIDER: 'Provider',
}

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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

  function trySave() {
    setError('')
    setFieldErrors({})
    const payload = {
      code,
      name,
      description,
      permission_codes: [...selected],
    }
    const parsed = isNew ? parseForm(roleCreateSchema, payload) : parseForm(roleEditSchema, payload)
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors)
      if (parsed.formError) setError(parsed.formError)
      return
    }
    save.mutate()
  }

  return (
    <Page
      crumbs={[
        { label: 'Organization', to: '/qrp/organization' },
        { label: 'People & access', to: '/qrp/admin/users?tab=roles' },
        { label: 'Roles', to: '/qrp/admin/users?tab=roles' },
        { label: isNew ? 'New role' : readOnly ? 'View role' : 'Edit role' },
      ]}
      title={isNew ? 'New role' : readOnly ? 'Role (system)' : 'Edit role'}
      {...opsPageGuidance.adminRoleEditor}
    >
      {error && <Notice tone="critical">{error}</Notice>}
      {readOnly && (
        <Notice tone="info">This is a system role and cannot be changed. Permissions are shown for reference.</Notice>
      )}

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Code" htmlFor="role-code" error={fieldErrors.code}>
            <input
              id="role-code"
              className={cn('field-input font-mono', fieldErrorClass(Boolean(fieldErrors.code)))}
              value={isNew ? code : (role.data?.code ?? '')}
              disabled={!isNew}
              placeholder="LAB_LEAD"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </FormField>
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
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <FormField label="Name" htmlFor="role-name" error={fieldErrors.name}>
            <input
              id="role-name"
              className={cn('field-input', fieldErrorClass(Boolean(fieldErrors.name)))}
              value={name}
              disabled={readOnly}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Description" htmlFor="role-desc" error={fieldErrors.description}>
            <input
              id="role-desc"
              className={cn('field-input', fieldErrorClass(Boolean(fieldErrors.description)))}
              value={description}
              disabled={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Permissions</h2>
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
        </div>
        <FieldAlert message={fieldErrors.permission_codes} />
        {permissions.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading permissions…</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {Object.entries(byModule).map(([module, perms]) => {
              const all = perms.every((p) => selected.has(p.code))
              return (
                <div key={module} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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
            disabled={save.isPending}
            onClick={trySave}
          >
            {save.isPending ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
          </button>
          <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => navigate('/qrp/admin/roles')}>
            Cancel
          </button>
        </div>
      )}
      <RelatedNav
        items={[
          { to: '/qrp/admin/users?tab=roles', label: 'All roles' },
          { to: '/qrp/admin/users', label: 'People & access' },
          { to: '/qrp/organization', label: 'Organization hub' },
        ]}
      />
    </Page>
  )
}
