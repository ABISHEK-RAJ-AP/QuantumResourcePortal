import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Page, PanelHeader } from '@/components/layout/Page'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { StatusBadge } from '@/components/status/StatusBadge'
import { InfoTip } from '@/components/ui/InfoTip'
import { Modal } from '@/components/ui/Modal'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/auth/hooks'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { message, QueryBody, Table } from '@/pages/workspace/shared/helpers'

type Row = Record<string, unknown>
type CatalogRole = { id: string; label: string; builtin?: boolean; permissions?: number; permission_ids?: string[] }

export function UsersPage() {
  const client = useQueryClient()
  const { openConfirm, confirmDialog } = useConfirmDialog()
  const { user } = useAuth()
  const session = user ? { username: user.principal_id, role: user.roles?.[0] ?? 'User' } : null
  const canManage = ['Admin', 'SuperAdmin', 'PlatformAdmin'].includes(session?.role || '')
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => qre<unknown>('/users'),
  })
  const catalog = useQuery({
    queryKey: ['role-catalog'],
    queryFn: () => qre<{ roles?: CatalogRole[] }>('/users/roles/catalog'),
  })
  const permCatalog = useQuery({
    queryKey: ['role-permissions'],
    queryFn: () => qre<{ permissions?: string[] }>('/users/roles/permissions'),
    enabled: canManage && roleOpen,
  })
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('Operator')
  const [newRoleId, setNewRoleId] = useState('')
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [cloneFrom, setCloneFrom] = useState('Viewer')
  const [picked, setPicked] = useState<string[]>([])
  const save = useMutation({
    mutationFn: () =>
      qre(`/users/${encodeURIComponent(username)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      setUsername('')
      setAssignOpen(false)
      void client.invalidateQueries({ queryKey: ['users'] })
    },
  })
  const createRole = useMutation({
    mutationFn: () =>
      qre('/users/roles', {
        method: 'POST',
        body: JSON.stringify({
          id: newRoleId,
          label: newRoleLabel || newRoleId,
          clone_from: cloneFrom || undefined,
          permissions: picked,
        }),
      }),
    onSuccess: () => {
      setRoleOpen(false)
      setNewRoleId('')
      setNewRoleLabel('')
      setPicked([])
      void client.invalidateQueries({ queryKey: ['role-catalog'] })
    },
  })
  const deleteRole = useMutation({
    mutationFn: (id: string) => qre(`/users/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['role-catalog'] }),
  })
  const roles = catalog.data?.roles ?? []
  const all = asList(query.data)
  const roleOptions = useMemo(() => {
    const ids = Array.from(new Set(all.map((row) => String(row.role || '')).filter(Boolean))).sort()
    return [{ id: 'all', label: 'All roles' }, ...ids.map((id) => ({ id, label: id }))]
  }, [all])
  const rows = all.filter((row) => {
    if (roleFilter !== 'all' && String(row.role || '') !== roleFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['username', 'role', 'email', 'org', 'full_name'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const mfaOn = all.filter((row) => Boolean(row.mfa_enabled)).length
  const orgs = new Set(all.map((row) => String(row.org || '')).filter(Boolean)).size
  const roleChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.role || 'unset')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
  }, [all])
  return (
    <Page
      crumbs={[{ label: 'Admin', to: '/qrp/settings' }, { label: 'Users & Roles' }]}
      title="Users & Roles"
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          {canManage ? (
            <button type="button" className="btn-ghost" onClick={() => setRoleOpen(true)} title="Create a catalog role from a clone">
              New role
            </button>
          ) : null}
          <button type="button" className="btn-primary" onClick={() => setAssignOpen(true)} title="Assign an existing catalog role">
            Assign role
          </button>
        </div>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <Modal open={assignOpen} title="Assign role" onClose={() => setAssignOpen(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const userLabel = username.trim()
            openConfirm({
              title: 'Assign role',
              body: `Grant role ${role} to ${userLabel || 'this user'}? Permissions take effect on their next request.`,
              confirmLabel: 'Assign',
              onConfirm: () => save.mutate(),
            })
          }}
        >
          <input
            required
            className={fieldClass}
            value={username}
            placeholder="Username"
            onChange={(event) => setUsername(event.target.value)}
            autoFocus
          />
          <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value)}>
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {save.error ? <p className="text-sm text-critical">{message(save.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonClass} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={roleOpen} title="New role" onClose={() => setRoleOpen(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            createRole.mutate()
          }}
        >
          <label className="text-xs">
            Id
            <input required className={fieldClass} value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)} placeholder="LabOps" />
          </label>
          <label className="text-xs">
            Label
            <input className={fieldClass} value={newRoleLabel} onChange={(e) => setNewRoleLabel(e.target.value)} placeholder="Lab operations" />
          </label>
          <label className="text-xs">
            Clone from
            <select className={fieldClass} value={cloneFrom} onChange={(e) => setCloneFrom(e.target.value)}>
              {roles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="max-h-40 overflow-auto rounded-lg border border-border p-2">
            <p className="mb-1 text-[11px] text-muted-foreground">Extra permissions</p>
            {(permCatalog.data?.permissions ?? []).map((perm) => (
              <label key={perm} className="flex items-center gap-2 py-0.5 text-xs">
                <input
                  type="checkbox"
                  checked={picked.includes(perm)}
                  onChange={(e) =>
                    setPicked((prev) => (e.target.checked ? [...prev, perm] : prev.filter((p) => p !== perm)))
                  }
                />
                {perm}
              </label>
            ))}
          </div>
          {createRole.error ? <p className="text-sm text-critical">{message(createRole.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setRoleOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonClass} disabled={createRole.isPending}>
              {createRole.isPending ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
      <KpiStrip>
        <MetricTile label="Users" value={query.isError ? '—' : all.length} />
        <MetricTile label="Roles" value={query.isError ? '—' : roleChart.length} />
        <MetricTile label="Orgs" value={query.isError ? '—' : orgs} />
        <MetricTile label="MFA on" value={query.isError ? '—' : mfaOn} />
      </KpiStrip>
      {roleChart.length > 0 ? (
        <ChartPanel title="Roles" empty={false}>
          {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <PieChart>
                <Pie data={roleChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                  {roleChart.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      ) : null}
      <Card>
        <FilterBar
          options={roleOptions}
          value={roleFilter}
          onChange={setRoleFilter}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search users…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No users"
            emptyBody="Directory empty for this organization."
            columns={[
              {
                key: 'username',
                label: 'User',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{text(row, 'username')}</span>
                    <span className="text-xs text-muted-foreground">{text(row, 'full_name')}</span>
                  </span>
                ),
              },
              { key: 'role', label: 'Role' },
              { key: 'email', label: 'Email' },
              { key: 'org', label: 'Org' },
              {
                key: 'mfa_enabled',
                label: 'MFA',
                render: (row) => (row.mfa_enabled ? <StatusBadge tone="success" label="On" /> : <span className="text-muted-foreground">Off</span>),
              },
            ]}
          />
        </QueryBody>
      </Card>
      <Card>
        <PanelHeader
          title="Role catalog"
          action={
            <InfoTip label="Role catalog">
              SuperAdmin, PlatformAdmin, and Admin share full platform permissions. Custom roles persist in data/custom_roles.json.
            </InfoTip>
          }
        >
        <QueryBody query={catalog}>
          <Table
            rows={roles as unknown as Row[]}
            emptyTitle="No roles"
            emptyBody="Role catalogue did not load. Refresh the page or ask an administrator to verify the roles API."
            columns={[
              { key: 'id', label: 'Id' },
              { key: 'label', label: 'Label' },
              {
                key: 'builtin',
                label: 'Kind',
                render: (row) => (row.builtin ? 'Built-in' : 'Custom'),
              },
              { key: 'permissions', label: 'Perms' },
              {
                key: 'actions',
                label: '',
                render: (row) =>
                  canManage && !row.builtin ? (
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      title="Delete custom role"
                      onClick={() => {
                        const roleId = String(row.id)
                        openConfirm({
                          title: 'Delete custom role',
                          body: `Delete role ${roleId} from the catalog? Users already assigned keep the label until reassigned.`,
                          confirmLabel: 'Delete',
                          danger: true,
                          onConfirm: () => deleteRole.mutate(roleId),
                        })
                      }}
                    >
                      Delete
                    </button>
                  ) : null,
              },
            ]}
          />
        </QueryBody>
        {deleteRole.error ? <p className="mt-2 text-sm text-critical">{message(deleteRole.error)}</p> : null}
        </PanelHeader>
      </Card>
      {confirmDialog}
    </Page>
  )
}
