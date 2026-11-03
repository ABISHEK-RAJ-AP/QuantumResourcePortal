import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { seedPortalDemo } from '@/api/seedDemo'
import { asList, qre, qreDownload, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ReservationCalendar } from '@/components/data/ReservationCalendar'
import { DataFreshness } from '@/components/data/DataFreshness'
import { FilterBar } from '@/components/data/FilterBar'
import { StatusBadge } from '@/components/status/StatusBadge'
import {
  Card,
  DetailSkeleton,
  EmptyState,
  MetricTile,
  Notice,
  Page,
  PanelHeader,
  stateLabel,
  stateTone,
} from '@/components/layout/Page'
import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'
import { clearSession, getSessionUser } from '@/lib/session'
import { message, QueryBody, shortId, Table } from '@/pages/workspace/screens'

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

type Row = Record<string, unknown>

const LIFECYCLE: WorkflowStep[] = [
  { id: 'registered', label: 'Registered' },
  { id: 'active', label: 'Active' },
  { id: 'maintenance', label: 'Service' },
  { id: 'retired', label: 'Retired' },
]

function lifecycleIndex(state: string) {
  if (state === 'registered') return 0
  if (state === 'active') return 1
  if (state === 'maintenance' || state === 'suspended') return 2
  if (state === 'retired') return 3
  return 0
}

export function AssetDetailPage() {
  const { assetId = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => qre<Row>(`/inventory/assets/${encodeURIComponent(assetId)}`),
    enabled: !!assetId,
  })
  const move = useMutation({
    mutationFn: (lifecycle_state: string) =>
      qre(`/inventory/assets/${encodeURIComponent(assetId)}/lifecycle`, {
        method: 'POST',
        body: JSON.stringify({ lifecycle_state }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['asset', assetId] }),
  })
  const row = query.data
  const state = String(row?.lifecycle_state || 'registered')
  const allowed = Array.isArray(row?.allowed_transitions) ? (row.allowed_transitions as string[]) : []

  return (
    <Page
      eyebrow="Resources · Asset"
      title={row ? stateLabel(state) : 'Asset'}
      description={`Registry id ${shortId(assetId, 14)}. Lifecycle moves only along allowed transitions.`}
      steps={LIFECYCLE}
      stepIndex={lifecycleIndex(state)}
      actions={
        <Link to="/qrp/inventory" className="btn-secondary">
          Back to inventory
        </Link>
      }
    >
      <QueryBody query={query}>
        {row && (
          <Card className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Class</dt>
                <dd className="mt-1 font-medium">{text(row, 'asset_class')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Execution</dt>
                <dd className="mt-1 font-medium">{text(row, 'execution_class')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Provider</dt>
                <dd className="mt-1 font-mono text-xs">{text(row, 'provider_id')}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={stateTone(state)} label={stateLabel(state)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {allowed.map((next) => (
                <button key={next} type="button" disabled={move.isPending} onClick={() => move.mutate(next)} className="btn-primary">
                  Move to {stateLabel(next)}
                </button>
              ))}
              {allowed.length === 0 && <p className="text-sm text-muted-foreground">No further transitions.</p>}
            </div>
            {move.error && <p className="text-sm text-critical">{message(move.error)}</p>}
          </Card>
        )}
      </QueryBody>
    </Page>
  )
}

export function ApprovalHistoryPage() {
  const query = useQuery({
    queryKey: ['approval-history'],
    queryFn: () => qre<unknown>('/governance/activity?limit=80'),
  })
  return (
    <Page
      eyebrow="Governance"
      title="Approval history"
      description="Append-only decisions. A later decision does not rewrite an earlier one."
      actions={
        <Link to="/qrp/approvals" className="text-sm font-medium text-primary hover:underline">
          Queue
        </Link>
      }
    >
      <Card>
        <QueryBody query={query}>
          <Table
            rows={asList(query.data)}
            columns={[
              { key: 'timestamp', label: 'When' },
              { key: 'actor', label: 'Actor' },
              { key: 'action', label: 'Decision' },
              {
                key: 'target_id',
                label: 'Workload',
                render: (row) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.target_id}`}>
                    {text(row, 'target_id')}
                  </Link>
                ),
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

const RECON_FILTERS = [
  { id: 'unresolved', label: 'Needs reconcile' },
  { id: 'all', label: 'All' },
  { id: 'dispatch_confirmed', label: 'Confirmed' },
  { id: 'dispatch_failed', label: 'Failed' },
  { id: 'dispatch_unresolved', label: 'Unresolved' },
  { id: 'dispatch_authorized', label: 'Authorized' },
] as const

function needsReconcile(row: Row) {
  const state = String(row.dispatch_state || '')
  return state === 'dispatch_unresolved' || state === 'dispatch_authorized'
}

export function ReconciliationPage() {
  const client = useQueryClient()
  const [filter, setFilter] = useState<(typeof RECON_FILTERS)[number]['id']>('unresolved')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['dispatch-attempts'],
    queryFn: () => qre<unknown>('/dispatch-attempts'),
  })
  const reconcile = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: string }) =>
      qre(`/dispatch-attempts/${encodeURIComponent(id)}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ outcome, reason: outcome }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['dispatch-attempts'] }),
  })
  const allRows = asList(query.data)
  const unresolvedCount = allRows.filter(needsReconcile).length
  const confirmedCount = allRows.filter((r) => r.dispatch_state === 'dispatch_confirmed').length
  const failedCount = allRows.filter((r) => r.dispatch_state === 'dispatch_failed').length
  let rows = allRows
  if (filter === 'unresolved') rows = allRows.filter(needsReconcile)
  else if (filter !== 'all') rows = allRows.filter((r) => String(r.dispatch_state || '') === filter)
  const q = search.trim().toLowerCase()
  if (q) {
    rows = rows.filter((row) =>
      ['attempt_id', 'workload_id', 'backend_id', 'dispatch_state'].some((key) =>
        String(row[key] ?? '')
          .toLowerCase()
          .includes(q),
      ),
    )
  }
  return (
    <Page
      eyebrow="Operations"
      title="Reconciliation"
      description="Record provider outcome for durable dispatch attempts. Do not retry ambiguous calls blindly."
      actions={
        <span className="flex flex-wrap gap-2">
          <Link className="btn-ghost" to="/qrp/jobs">
            Provider jobs
          </Link>
          <Link className="btn-ghost" to="/qrp/dispatch">
            Dispatch ICD
          </Link>
          <DataFreshness updatedAt={query.dataUpdatedAt} />
        </span>
      }
    >
      <Notice tone="info">
        Expected = QRP authorized / unresolved attempt. Observed = reconcile outcome (confirmed needs external job id; failed /
        unresolved do not resubmit).
      </Notice>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Needs reconcile" value={unresolvedCount} hint="Authorized or unresolved" tone={unresolvedCount ? 'critical' : 'neutral'} />
        <MetricTile label="Confirmed" value={confirmedCount} hint="External outcome confirmed" tone="success" />
        <MetricTile label="Failed" value={failedCount} hint="Recorded failures" tone="warning" />
      </div>
      <Card>
        <FilterBar
          options={RECON_FILTERS}
          value={filter}
          onChange={(id) => setFilter(id as (typeof RECON_FILTERS)[number]['id'])}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search attempts…"
          defaultId="unresolved"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No attempts"
            emptyBody={
              filter === 'unresolved'
                ? 'No authorized or unresolved attempts. Attempts appear after approve → authorize → record attempt.'
                : 'Dispatch attempts appear after authorisation.'
            }
            columns={[
              {
                key: 'attempt_id',
                label: 'Attempt',
                render: (row) => <CopyableId value={String(row.attempt_id || '')} />,
              },
              {
                key: 'workload_id',
                label: 'Workload',
                render: (row) =>
                  row.workload_id ? (
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                      {text(row, 'workload_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'dispatch_state',
                label: 'Expected / state',
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.dispatch_state || ''))} label={stateLabel(String(row.dispatch_state || 'open'))} />
                ),
              },
              { key: 'execution_class', label: 'Class', sortable: true },
              {
                key: 'external_job_id',
                label: 'Observed job',
                render: (row) =>
                  row.external_job_id ? (
                    <Link className="font-mono text-xs text-primary hover:underline" to={`/qrp/jobs/${row.external_job_id}`}>
                      {text(row, 'external_job_id')}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not reported</span>
                  ),
              },
              {
                key: 'backend_id',
                label: 'Backend',
                render: (row) =>
                  row.backend_id ? (
                    <Link className="hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'actions',
                label: 'Resolve',
                render: (row) =>
                  needsReconcile(row) ? (
                    <span className="flex flex-wrap gap-2">
                      {['confirmed', 'failed', 'unresolved'].map((outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          className="text-sm font-medium text-primary hover:underline"
                          disabled={reconcile.isPending}
                          onClick={() => {
                            if (window.confirm(`Mark attempt as ${outcome}?`)) {
                              reconcile.mutate({ id: String(row.attempt_id), outcome })
                            }
                          }}
                        >
                          {outcome}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  ),
              },
            ]}
          />
        </QueryBody>
        {reconcile.error && <p className="mt-3 text-sm text-critical">{message(reconcile.error)}</p>}
      </Card>
    </Page>
  )
}

const fieldClass = 'field-input'
const buttonClass = 'btn-primary'

function defaultLocalWindow() {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const toLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return { window_start: toLocal(start), window_end: toLocal(end) }
}

export function SchedulingPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['reservations'],
    queryFn: () => qre<unknown>('/reservations'),
  })
  const assets = useQuery({
    queryKey: ['assets-scheduling'],
    queryFn: async () => asList(await qre<unknown>('/inventory/assets')),
    retry: false,
  })
  const projects = useQuery({
    queryKey: ['projects-scheduling'],
    queryFn: async () => asList(await qre<unknown>('/projects')),
    retry: false,
  })
  const [form, setForm] = useState({ resource_ref: '', project_id: '', purpose: '', ...defaultLocalWindow() })
  const create = useMutation({
    mutationFn: () =>
      qre<Row>('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          resource_ref: form.resource_ref,
          project_id: form.project_id || null,
          window_start: new Date(form.window_start).toISOString(),
          window_end: new Date(form.window_end).toISOString(),
          purpose: form.purpose,
        }),
      }),
    onSuccess: (row) => {
      setForm({ resource_ref: '', project_id: '', purpose: '', ...defaultLocalWindow() })
      void client.invalidateQueries({ queryKey: ['reservations'] })
      if (row.reservation_id) navigate('/qrp/reservations')
    },
  })
  const holds = asList(query.data)
  const prefillFromDay = (dateStr: string) => {
    // Local midday → mid+2h window so new hold lands on the clicked calendar day.
    const start = `${dateStr}T10:00`
    const end = `${dateStr}T12:00`
    setForm((prev) => ({ ...prev, window_start: start, window_end: end }))
  }
  return (
    <Page
      eyebrow="Governance · Allocation"
      title="Request reservation window"
      description="Plan a governance hold. Calendar shows existing holds (not provider availability). Hold ≠ booking · Hold ≠ dispatch."
      actions={
        <span className="flex flex-wrap gap-2">
          <Link to="/qrp/reservations" className="btn-secondary">
            Reservation calendar
          </Link>
          <Link to="/qrp/approvals" className="btn-ghost">
            Review queue
          </Link>
        </span>
      }
    >
      <Notice tone="info">
        Conflicts are detected against other QRP holds on the same resource_ref. This is not a live provider schedule.
      </Notice>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <PanelHeader title="New hold" />
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              create.mutate()
            }}
          >
            <label className="text-sm sm:col-span-2">
              Resource
              <input
                required
                list="sched-assets"
                className={fieldClass}
                value={form.resource_ref}
                placeholder="Asset or backend ref"
                onChange={(e) => setForm({ ...form, resource_ref: e.target.value })}
              />
              <datalist id="sched-assets">
                {assets.data?.map((a) => (
                  <option key={String(a.asset_id)} value={String(a.native_asset_id || a.asset_id)}>
                    {String(a.execution_class || '')} · {String(a.provider_id || '')}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="text-sm sm:col-span-2">
              Project
              <select className={fieldClass} value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">No project</option>
                {projects.data?.map((p) => (
                  <option key={String(p.project_id)} value={String(p.project_id)}>
                    {String(p.name || p.project_id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Window start (local)
              <input required type="datetime-local" className={fieldClass} value={form.window_start} onChange={(e) => setForm({ ...form, window_start: e.target.value })} />
            </label>
            <label className="text-sm">
              Window end (local)
              <input required type="datetime-local" className={fieldClass} value={form.window_end} onChange={(e) => setForm({ ...form, window_end: e.target.value })} />
            </label>
            <label className="text-sm sm:col-span-2">
              Purpose
              <input required className={fieldClass} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass} disabled={create.isPending}>
                {create.isPending ? 'Submitting…' : 'Request window'}
              </button>
              {create.error && <p className="mt-2 text-sm text-critical">{message(create.error)}</p>}
            </div>
          </form>
        </Card>
        <Card>
          <PanelHeader
            title="Existing holds (calendar)"
            action={<span className="text-xs text-muted-foreground tabular-nums">{holds.length} rows</span>}
          />
          <QueryBody query={query}>
            <ReservationCalendar rows={holds} title="Hold calendar" onDaySelect={(dateStr) => prefillFromDay(dateStr)} />
          </QueryBody>
        </Card>
      </div>
    </Page>
  )
}

export function SlaPage() {
  return (
    <Page
      eyebrow="Not in operational scope"
      title="SLA"
      description="QRP does not provide an SLA ledger, breach predictions, or service credits in this release."
      actions={
        <Link className="btn-primary" to="/qrp/metering">
          Metering
        </Link>
      }
    >
      <Notice tone="warning">No SLA target or breach API. Observed usage stays on Metering — not an SLA %.</Notice>
    </Page>
  )
}

export function NotificationsPage() {
  return (
    <Page
      eyebrow="Not in operational scope"
      title="Notifications"
      description="Persistent notification delivery and preference centre are not implemented."
      actions={
        <span className="flex flex-wrap gap-2">
          <Link className="btn-primary" to="/qrp/audit">
            Audit log
          </Link>
          <Link className="btn-secondary" to="/qrp/approvals/history">
            Approval history
          </Link>
        </span>
      }
    >
      <Notice tone="info">No in-app notification inbox. Governance activity remains on Audit.</Notice>
    </Page>
  )
}

export function EntitlementsPage() {
  return (
    <Page
      eyebrow="Not in operational scope"
      title="Entitlements"
      description="Provider entitlement grants stay outside QRP. Daily simulation-shot caps live on the quota ledger."
      actions={
        <span className="flex flex-wrap gap-2">
          <Link className="btn-primary" to="/qrp/quotas">
            Quotas
          </Link>
          <Link className="btn-secondary" to="/qrp/users">
            Users
          </Link>
        </span>
      }
    >
      <Notice tone="warning">Entitlement writes not enabled. Identity-provider entitlements are external to QRP.</Notice>
    </Page>
  )
}

export function OnboardingPage() {
  const query = useQuery({
    queryKey: ['providers'],
    queryFn: () => qre<unknown>('/providers'),
  })
  return (
    <Page
      eyebrow="Resources"
      title="Provider onboarding board"
      description="Stage codes from the connector catalogue. Open a provider to publish a manifest and activate."
      actions={
        <Link className="btn-secondary" to="/qrp/providers">
          Provider list
        </Link>
      }
    >
      <Card>
        <QueryBody query={query}>
          <Table
            rows={asList(query.data)}
            columns={[
              { key: 'provider_name', label: 'Provider' },
              { key: 'provider_id', label: 'Id' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={stateTone(String(row.status || 'active'))} label={stateLabel(String(row.status || 'active'))} />,
              },
              {
                key: 'integration',
                label: 'Stage',
                render: (row) => {
                  const integration = (row.integration as Row | undefined) ?? {}
                  return text(integration, 'stage')
                },
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function RegisterAssetPage() {
  const [form, setForm] = useState({
    provider_id: '',
    native_asset_id: '',
    asset_class: '',
    execution_class: 'simulated',
  })
  const [created, setCreated] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      qre<Row>('/inventory/assets', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (row) => setCreated(String(row.asset_id || 'created')),
  })
  return (
    <Page
      eyebrow="Resources"
      title="Register asset"
      description="One asset, one provider, one native id."
      actions={
        <Link to="/qrp/inventory" className="btn-secondary">
          Inventory
        </Link>
      }
    >
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <label className="text-sm">
            Provider id
            <input required className={fieldClass} value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })} />
          </label>
          <label className="text-sm">
            Native asset id
            <input required className={fieldClass} value={form.native_asset_id} onChange={(e) => setForm({ ...form, native_asset_id: e.target.value })} />
          </label>
          <label className="text-sm">
            Asset class
            <input required className={fieldClass} value={form.asset_class} placeholder="QPU" onChange={(e) => setForm({ ...form, asset_class: e.target.value })} />
          </label>
          <label className="text-sm">
            Execution
            <select className={fieldClass} value={form.execution_class} onChange={(e) => setForm({ ...form, execution_class: e.target.value })}>
              <option value="simulated">simulated</option>
              <option value="hardware">hardware</option>
            </select>
          </label>
          <div>
            <button type="submit" className={buttonClass} disabled={save.isPending}>
              Register
            </button>
            {created && <p className="mt-2 text-sm text-success-text">Registered {created}</p>}
            {save.error && <p className="mt-2 text-sm text-critical">{message(save.error)}</p>}
          </div>
        </form>
      </Card>
    </Page>
  )
}

export function ImportAssetsPage() {
  const [providerId, setProviderId] = useState('')
  const [csv, setCsv] = useState('native_asset_id,asset_class,execution_class\n')
  const [result, setResult] = useState<Row | null>(null)
  const run = useMutation({
    mutationFn: () =>
      qre<Row>('/inventory/imports', {
        method: 'POST',
        body: JSON.stringify({ provider_id: providerId, csv_text: csv }),
      }),
    onSuccess: (body) => setResult(body),
  })
  const errors = Array.isArray(result?.errors) ? (result.errors as Row[]) : []
  return (
    <Page
      eyebrow="Resources"
      title="Import assets"
      description="CSV columns: native_asset_id, asset_class, execution_class. A bad row commits nothing."
      actions={
        <Link to="/qrp/inventory" className="btn-secondary">
          Inventory
        </Link>
      }
    >
      <Card>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            run.mutate()
          }}
        >
          <label className="text-sm">
            Provider id
            <input required className={fieldClass} value={providerId} onChange={(e) => setProviderId(e.target.value)} />
          </label>
          <label className="text-sm">
            CSV
            <textarea required rows={8} className={`${fieldClass} font-mono text-xs`} value={csv} onChange={(e) => setCsv(e.target.value)} />
          </label>
          <div>
            <button type="submit" className={buttonClass} disabled={run.isPending}>
              Commit import
            </button>
            {run.error && <p className="mt-2 text-sm text-critical">{message(run.error)}</p>}
          </div>
        </form>
        {result && (
          <p className="mt-3 text-sm">
            {result.committed ? `Committed ${String(result.created)} assets.` : 'Not committed.'}
          </p>
        )}
        {errors.length > 0 && (
          <ul className="mt-2 text-sm text-critical">
            {errors.map((err, i) => (
              <li key={i}>
                Row {String(err.row ?? '—')}: {String(err.detail)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  )
}

function MemberForm({ projectId }: { projectId: string }) {
  const client = useQueryClient()
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('editor')
  const add = useMutation({
    mutationFn: () =>
      qre(`/projects/${encodeURIComponent(projectId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ username, role }),
      }),
    onSuccess: () => {
      setUsername('')
      void client.invalidateQueries({ queryKey: ['project-members', projectId] })
    },
  })
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        add.mutate()
      }}
    >
      <input required className={fieldClass} value={username} placeholder="Username" onChange={(event) => setUsername(event.target.value)} />
      <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value)}>
        <option value="editor">editor</option>
        <option value="viewer">viewer</option>
      </select>
      <button type="submit" className={buttonClass} disabled={add.isPending}>
        Add member
      </button>
      {add.error && <p className="w-full text-sm text-critical">{message(add.error)}</p>}
    </form>
  )
}

const PROJECT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'requests', label: 'Requests' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'usage', label: 'Usage' },
  { id: 'activity', label: 'Activity' },
] as const

type ProjectTab = (typeof PROJECT_TABS)[number]['id']

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: ProjectTab = PROJECT_TABS.some((t) => t.id === tabParam) ? (tabParam as ProjectTab) : 'overview'
  const setTab = (id: ProjectTab) => {
    if (id === 'overview') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: id }, { replace: true })
  }

  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [resourceHint, setResourceHint] = useState('')

  const client = useQueryClient()
  const submit = useMutation({
    mutationFn: async () => {
      const metadata: Record<string, string> = {}
      if (purpose.trim()) metadata.purpose = purpose.trim()
      if (notes.trim()) metadata.notes = notes.trim()
      if (resourceHint.trim()) metadata.resource_hint = resourceHint.trim()
      const created = await qre<Row>('/workload-submissions', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, metadata }),
      })
      return qre<Row>(`/workload-submissions/${encodeURIComponent(String(created.submission_id))}/submit-for-review`, {
        method: 'POST',
      })
    },
    onSuccess: (row) => {
      setPurpose('')
      setNotes('')
      setResourceHint('')
      void client.invalidateQueries({ queryKey: ['project-approvals', projectId] })
      void client.invalidateQueries({ queryKey: ['project-activity', projectId] })
      if (row.workload_id) navigate(`/qrp/approvals/${row.workload_id}`)
    },
  })
  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => qre<Row>(`/projects/${encodeURIComponent(projectId)}`),
    enabled: !!projectId,
  })
  const members = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => qre<unknown>(`/projects/${encodeURIComponent(projectId)}/members`),
    enabled: !!projectId,
  })
  const approvals = useQuery({
    queryKey: ['project-approvals', projectId],
    queryFn: async () => asList(await qre<unknown>(`/approvals?project_id=${encodeURIComponent(projectId)}`)),
    enabled: !!projectId,
    retry: false,
  })
  const reservations = useQuery({
    queryKey: ['project-reservations', projectId],
    queryFn: async () => asList(await qre<unknown>(`/reservations?project_id=${encodeURIComponent(projectId)}`)),
    enabled: !!projectId,
    retry: false,
  })
  const quota = useQuery({
    queryKey: ['project-quota', projectId],
    queryFn: () => qre<Row>(`/quotas/ledger?window=today&project_id=${encodeURIComponent(projectId)}`),
    enabled: !!projectId,
    retry: false,
  })
  const activity = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: async () => asList(await qre<unknown>(`/governance/activity?project_id=${encodeURIComponent(projectId)}&limit=30`)),
    enabled: !!projectId,
    retry: false,
  })
  const memberRows = asList(members.data)
  const approvalRows = approvals.data ?? []
  const reservationRows = reservations.data ?? []
  const activityRows = activity.data ?? []
  const openApprovals = approvalRows.filter((r) =>
    ['submitted_for_review', 'in_review', 'changes_requested'].includes(String(r.governance_state || '')),
  ).length
  const locked = Boolean(project.data?.submission_lock)
  const projectName = String(project.data?.name || projectId)

  return (
    <Page
      eyebrow="Workspace · Projects"
      title={projectName}
      description="Work queue for this project: open reviews, holds, quota, then request creation. Owner/type meta is secondary."
      actions={
        <span className="flex flex-wrap gap-2">
          <CopyableId value={projectId} keep={14} />
          <button type="button" className="btn-primary" onClick={() => setTab('requests')}>
            {locked ? 'View requests' : 'Create resource request'}
          </button>
          <Link to="/qrp/scheduling" className="btn-secondary">
            Request hold
          </Link>
          <Link to="/qrp/projects" className="btn-ghost">
            All projects
          </Link>
        </span>
      }
    >
      {project.isPending ? (
        <DetailSkeleton />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Open reviews" value={approvals.isError ? '—' : openApprovals} hint="In queue for this project" tone={openApprovals ? 'warning' : 'neutral'} />
            <MetricTile label="Requests" value={approvals.isError ? '—' : approvalRows.length} hint="All linked workloads" />
            <MetricTile label="Holds" value={reservations.isError ? '—' : reservationRows.length} hint="Reservation windows" />
            <MetricTile label="Members" value={members.isError ? '—' : memberRows.length} hint="Directory membership" />
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Project sections">
            {PROJECT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'btn-secondary' : 'btn-ghost'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <QueryBody query={project}>
              {project.data && (
                <div className="space-y-4">
                  {locked ? (
                    <Notice tone="warning">
                      Submission locked while a request is under review. Finish or withdraw the open review before creating another —{' '}
                      <button type="button" className="font-medium text-primary hover:underline" onClick={() => setTab('requests')}>
                        open Requests
                      </button>
                      .
                    </Notice>
                  ) : null}

                  <Card className="space-y-3">
                    <PanelHeader title="What needs attention" />
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('requests')}>
                        <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Open reviews</span>
                        <span className="text-lg font-semibold tabular-nums">{approvals.isError ? '—' : openApprovals}</span>
                      </button>
                      <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('reservations')}>
                        <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Active / requested holds</span>
                        <span className="text-lg font-semibold tabular-nums">
                          {reservations.isError
                            ? '—'
                            : reservationRows.filter((r) => ['requested', 'active'].includes(String(r.state || ''))).length}
                        </span>
                      </button>
                      <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('usage')}>
                        <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Shots remaining today</span>
                        <span className="text-lg font-semibold tabular-nums">{quota.isError ? '—' : String(quota.data?.remaining_shots ?? '—')}</span>
                      </button>
                      <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('activity')}>
                        <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Recent decisions</span>
                        <span className="text-lg font-semibold tabular-nums">{activity.isError ? '—' : activityRows.length}</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <button type="button" className="btn-primary" onClick={() => setTab('requests')}>
                        {locked ? 'Review open requests' : 'Create resource request'}
                      </button>
                      <Link className="btn-secondary" to="/qrp/scheduling">
                        Request hold window
                      </Link>
                      <Link className="btn-ghost" to="/qrp/inventory">
                        Browse catalogue
                      </Link>
                      <Link className="btn-ghost" to="/qrp/approvals">
                        Institution Review Queue
                      </Link>
                    </div>
                  </Card>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="space-y-3">
                      <PanelHeader
                        title="Latest requests"
                        action={
                          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setTab('requests')}>
                            All requests
                          </button>
                        }
                      />
                      <QueryBody query={approvals}>
                        <Table
                          rows={approvalRows.slice(0, 5)}
                          emptyTitle="No requests"
                          emptyBody="Create a resource request to start governance review for this project."
                          columns={[
                            {
                              key: 'workload_id',
                              label: 'Request',
                              render: (row) => (
                                <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                                  {shortId(String(row.workload_id || ''), 12)}
                                </Link>
                              ),
                            },
                            {
                              key: 'governance_state',
                              label: 'State',
                              render: (row) => (
                                <StatusBadge
                                  tone={stateTone(String(row.governance_state || ''))}
                                  label={stateLabel(String(row.governance_state || 'unknown'))}
                                />
                              ),
                            },
                            { key: 'created_by', label: 'By' },
                          ]}
                        />
                      </QueryBody>
                    </Card>
                    <Card className="space-y-3">
                      <PanelHeader
                        title="Holds & quota"
                        action={
                          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setTab('reservations')}>
                            Calendar
                          </button>
                        }
                      />
                      {quota.isError ? (
                        <p className="text-sm text-muted-foreground">Quota ledger unavailable.</p>
                      ) : (
                        <p className="text-sm">
                          Today (UTC): <span className="font-semibold tabular-nums">{String(quota.data?.used_shots ?? '—')}</span> used /{' '}
                          <span className="font-semibold tabular-nums">{String(quota.data?.daily_shots_cap ?? '—')}</span> cap · remaining{' '}
                          <span className="font-semibold tabular-nums">{String(quota.data?.remaining_shots ?? '—')}</span>
                        </p>
                      )}
                      <QueryBody query={reservations}>
                        <Table
                          rows={reservationRows.slice(0, 4)}
                          emptyTitle="No holds"
                          emptyBody="No reservation windows on this project yet."
                          columns={[
                            {
                              key: 'reservation_id',
                              label: 'Hold',
                              render: (row) => (
                                <Link className="font-medium text-primary hover:underline" to="/qrp/reservations">
                                  {shortId(String(row.reservation_id || ''), 10)}
                                </Link>
                              ),
                            },
                            {
                              key: 'state',
                              label: 'State',
                              render: (row) => (
                                <StatusBadge tone={stateTone(String(row.state || ''))} label={stateLabel(String(row.state || 'requested'))} />
                              ),
                            },
                            { key: 'resource_ref', label: 'Resource' },
                          ]}
                        />
                      </QueryBody>
                    </Card>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Meta · owner {text(project.data, 'owner_username')} · type {text(project.data, 'project_type')} ·{' '}
                    {project.data.is_archived ? 'archived' : 'open'}
                    {project.data.description ? ` · ${String(project.data.description).slice(0, 120)}` : ''} · members on Members tab
                  </p>
                </div>
              )}
            </QueryBody>
          )}

          {tab === 'members' && (
            <Card className="space-y-3">
              <PanelHeader title="Members" />
              <Notice tone="info">Project membership is not a second IdP. Assign application roles only for directory users already known to the institution.</Notice>
              <MemberForm projectId={projectId} />
              <QueryBody query={members}>
                <Table
                  rows={memberRows}
                  emptyTitle="No members listed"
                  emptyBody="Add a directory user with editor or viewer role."
                  columns={[
                    { key: 'username', label: 'User' },
                    { key: 'role', label: 'Role' },
                  ]}
                />
              </QueryBody>
            </Card>
          )}

          {tab === 'requests' && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="space-y-3">
                <PanelHeader title="Create resource request" />
                <Notice tone="info">
                  Creates a workload submission then submits it for governance review. Approval ≠ provider dispatch. Package includes purpose metadata when provided.
                </Notice>
                {locked ? (
                  <EmptyState title="Submission locked" body="This project is locked while a review is in progress." />
                ) : (
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      submit.mutate()
                    }}
                  >
                    <label className="text-sm">
                      Purpose
                      <input
                        required
                        className={fieldClass}
                        value={purpose}
                        placeholder="Scientific / technical purpose for reviewers"
                        onChange={(e) => setPurpose(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      Resource hint (optional)
                      <input
                        className={fieldClass}
                        value={resourceHint}
                        placeholder="e.g. simulator class or catalogue ref — not a booking"
                        onChange={(e) => setResourceHint(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      Notes for reviewers (optional)
                      <textarea className={fieldClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className={buttonClass} disabled={submit.isPending}>
                        {submit.isPending ? 'Submitting…' : 'Submit for review'}
                      </button>
                      <Link className="btn-ghost" to="/qrp/approvals">
                        Open Review Queue
                      </Link>
                    </div>
                    {submit.error && <p className="text-sm text-critical">{message(submit.error)}</p>}
                  </form>
                )}
              </Card>
              <Card className="space-y-3">
                <PanelHeader
                  title="Project requests"
                  action={
                    <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/approvals">
                      Queue
                    </Link>
                  }
                />
                <QueryBody query={approvals}>
                  <Table
                    rows={approvalRows}
                    emptyTitle="No requests yet"
                    emptyBody="Submit a request to open a workload on the configured policy stages."
                    columns={[
                      {
                        key: 'workload_id',
                        label: 'Request',
                        render: (row) => (
                          <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                            {shortId(String(row.workload_id || ''), 12)}
                          </Link>
                        ),
                      },
                      {
                        key: 'governance_state',
                        label: 'State',
                        render: (row) => (
                          <StatusBadge
                            tone={stateTone(String(row.governance_state || ''))}
                            label={stateLabel(String(row.governance_state || 'unknown'))}
                          />
                        ),
                      },
                      { key: 'created_by', label: 'Requester' },
                    ]}
                  />
                </QueryBody>
              </Card>
            </div>
          )}

          {tab === 'reservations' && (
            <div className="space-y-4">
              <Card className="space-y-3">
                <PanelHeader
                  title="Reservation holds"
                  action={
                    <Link className="btn-secondary" to="/qrp/scheduling">
                      Request window
                    </Link>
                  }
                />
                <Notice tone="info">Hold ≠ provider-confirmed booking · Hold ≠ dispatch authorisation.</Notice>
                <QueryBody query={reservations}>
                  <Table
                    rows={reservationRows}
                    emptyTitle="No holds"
                    emptyBody="Request a window after (or while planning) governance approval."
                    columns={[
                      {
                        key: 'reservation_id',
                        label: 'Hold',
                        render: (row) => (
                          <Link className="font-medium text-primary hover:underline" to="/qrp/reservations">
                            {shortId(String(row.reservation_id || ''), 12)}
                          </Link>
                        ),
                      },
                      {
                        key: 'state',
                        label: 'State',
                        render: (row) => (
                          <StatusBadge tone={stateTone(String(row.state || ''))} label={stateLabel(String(row.state || 'requested'))} />
                        ),
                      },
                      { key: 'resource_ref', label: 'Resource' },
                      { key: 'window_start', label: 'Start' },
                      { key: 'window_end', label: 'End' },
                    ]}
                  />
                </QueryBody>
              </Card>
              <Card>
                <PanelHeader title="Hold calendar" />
                <QueryBody query={reservations}>
                  <ReservationCalendar rows={reservationRows} title={`${projectName} holds`} />
                </QueryBody>
              </Card>
            </div>
          )}

          {tab === 'usage' && (
            <Card className="space-y-3">
              <PanelHeader
                title="Quota & usage"
                action={
                  <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/quotas">
                    Institution ledger
                  </Link>
                }
              />
              {quota.isError ? (
                <EmptyState title="Quota unavailable" body={message(quota.error)} />
              ) : quota.isPending ? (
                <div className="h-32 animate-pulse rounded-lg bg-muted" />
              ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Used (today UTC)</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{String(quota.data?.used_shots ?? '—')}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Cap</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{String(quota.data?.daily_shots_cap ?? '—')}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Remaining</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{String(quota.data?.remaining_shots ?? '—')}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Window</dt>
                    <dd className="mt-1 font-medium">{String(quota.data?.window || 'today')}</dd>
                  </div>
                </dl>
              )}
              <Notice tone="info">Daily simulation-shot cap is separate from lifetime usage. Incomplete metering is not shown as zero.</Notice>
              <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/metering">
                Open metering →
              </Link>
            </Card>
          )}

          {tab === 'activity' && (
            <Card className="space-y-3">
              <PanelHeader
                title="Governance activity"
                action={
                  <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/audit">
                    Audit trail
                  </Link>
                }
              />
              {activity.isError ? (
                <EmptyState title="Activity unavailable" body={message(activity.error)} />
              ) : (
                <Table
                  rows={activityRows}
                  emptyTitle="No activity yet"
                  emptyBody="Approval decisions for this project appear here after reviews."
                  columns={[
                    { key: 'timestamp', label: 'When' },
                    { key: 'actor', label: 'Actor' },
                    { key: 'action', label: 'Action' },
                    {
                      key: 'target_id',
                      label: 'Request',
                      render: (row) =>
                        row.target_id ? (
                          <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.target_id}`}>
                            {shortId(String(row.target_id), 12)}
                          </Link>
                        ) : (
                          '—'
                        ),
                    },
                  ]}
                />
              )}
            </Card>
          )}
        </>
      )}
    </Page>
  )
}

function formatAlertAge(iso: unknown) {
  const t = new Date(String(iso || '')).getTime()
  if (!Number.isFinite(t)) return '—'
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function alertMetricUnit(alertType: string) {
  const t = alertType.toUpperCase()
  if (t.includes('T1') || t.includes('T2')) return 'µs'
  if (t.includes('READOUT') || t.includes('ERROR') || t.includes('FIDELITY')) return ''
  return ''
}

function explainAlert(row: Row, current: number, threshold: number) {
  const type = String(row.alert_type || '')
  const unit = alertMetricUnit(type)
  const hasNums = Number.isFinite(current) && Number.isFinite(threshold)
  const delta = hasNums ? current - threshold : null
  const below = delta != null && delta < 0
  if (type === 'LOW_T1') {
    return hasNums
      ? `T1 coherence on this qubit is ${Math.abs(delta!).toFixed(2)}${unit} ${below ? 'below' : 'above'} the ${threshold.toFixed(1)}${unit} floor. Below-floor T1 raises decoherence risk for circuits that rely on this qubit.`
      : 'LOW_T1 detector fired; numeric reading unavailable from API.'
  }
  if (type === 'LOW_T2') {
    return hasNums
      ? `T2 dephasing time is ${Math.abs(delta!).toFixed(2)}${unit} ${below ? 'below' : 'above'} threshold ${threshold.toFixed(1)}${unit}.`
      : 'LOW_T2 detector fired; numeric reading unavailable.'
  }
  return hasNums
    ? `Detector ${type}: observed ${current.toFixed(2)}${unit ? ` ${unit}` : ''} vs threshold ${threshold.toFixed(2)}${unit ? ` ${unit}` : ''} (Δ ${delta!.toFixed(2)}).`
    : `Detector ${type} fired on ${String(row.resource_id || 'resource')}.`
}

export function AlertDetailPage() {
  const { alertId = '' } = useParams()
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const query = useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => qre<Row>(`/alerts/${encodeURIComponent(alertId)}`),
    enabled: !!alertId,
  })
  const row = query.data
  const resourceId = row?.resource_id ? String(row.resource_id) : ''
  const backendId = row?.backend_id ? String(row.backend_id) : ''
  const incidentId = row?.incident_id ? String(row.incident_id) : ''

  const related = useQuery({
    queryKey: ['alert-related', resourceId],
    queryFn: async () => asList(await qre<unknown>(`/alerts?resource_id=${encodeURIComponent(resourceId)}&limit=20`)),
    enabled: !!resourceId,
    retry: false,
  })
  const incident = useQuery({
    queryKey: ['alert-incident', incidentId],
    queryFn: () => qre<Row>(`/incidents/${encodeURIComponent(incidentId)}`),
    enabled: !!incidentId,
    retry: false,
  })
  const backend = useQuery({
    queryKey: ['alert-backend', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}`),
    enabled: !!backendId,
    retry: false,
  })

  const invalidateAlert = () => {
    void client.invalidateQueries({ queryKey: ['alert', alertId] })
    void client.invalidateQueries({ queryKey: ['alert-related', resourceId] })
    void client.invalidateQueries({ queryKey: ['alerts'] })
  }

  const advance = useMutation({
    mutationFn: async (action: 'acknowledge' | 'resolve') => {
      if (note.trim()) {
        await qre(`/alerts/${encodeURIComponent(alertId)}/comments`, {
          method: 'POST',
          body: JSON.stringify({ text: note.trim() }),
        })
      }
      return qre(`/alerts/${encodeURIComponent(alertId)}/${action}`, {
        method: 'POST',
        body: JSON.stringify(
          action === 'acknowledge'
            ? { comment: note.trim() || undefined }
            : { resolution_notes: note.trim() || undefined },
        ),
      })
    },
    onSuccess: () => {
      setNote('')
      invalidateAlert()
      if (incidentId) void client.invalidateQueries({ queryKey: ['alert-incident', incidentId] })
    },
  })
  const comment = useMutation({
    mutationFn: () =>
      qre(`/alerts/${encodeURIComponent(alertId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: note }),
      }),
    onSuccess: () => {
      setNote('')
      invalidateAlert()
    },
  })

  const status = String(row?.status || 'open')
  const comments = Array.isArray(row?.comments) ? (row.comments as Row[]) : []
  const current = Number(row?.current_value)
  const threshold = Number(row?.threshold_value)
  const unit = alertMetricUnit(String(row?.alert_type || ''))
  const delta = Number.isFinite(current) && Number.isFinite(threshold) ? current - threshold : null
  const breachPct =
    Number.isFinite(current) && Number.isFinite(threshold) && threshold !== 0
      ? Math.round((current / threshold) * 100)
      : null
  const severity = String(row?.severity || 'info').toLowerCase()
  const relatedRows = (related.data ?? []).filter((r) => String(r.alert_id) !== alertId)
  const incidentAlerts = Array.isArray(incident.data?.alerts) ? (incident.data!.alerts as Row[]) : []
  const siblingOnBackend = incidentAlerts.filter((r) => String(r.alert_id) !== alertId).slice(0, 8)

  return (
    <Page
      eyebrow="Operations · Alert investigation"
      title={row ? String(row.alert_type || 'Alert') : 'Alert'}
      description={
        row
          ? `${String(row.message || '')} · Detected ${formatAlertAge(row.detected_at)} · ${String(row.resource_id || '')}`
          : `Alert ${shortId(alertId, 12)}`
      }
      actions={
        <span className="flex flex-wrap gap-2">
          <CopyableId value={alertId} keep={14} />
          <Link to="/qrp/support" className="btn-secondary">
            Alert queue
          </Link>
          {incidentId ? (
            <Link to={`/qrp/incidents/${incidentId}`} className="btn-primary">
              Open incident ({String(incident.data?.alert_count ?? '…')})
            </Link>
          ) : null}
        </span>
      }
    >
      {query.isPending ? (
        <DetailSkeleton />
      ) : (
        <QueryBody query={query}>
          {row && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricTile
                  label={`Observed${unit ? ` (${unit})` : ''}`}
                  value={Number.isFinite(current) ? current.toFixed(2) : '—'}
                  hint="Detector current_value"
                  tone={severity === 'critical' ? 'critical' : 'warning'}
                />
                <MetricTile
                  label={`Threshold${unit ? ` (${unit})` : ''}`}
                  value={Number.isFinite(threshold) ? threshold.toFixed(2) : '—'}
                  hint="Rule floor / ceiling"
                />
                <MetricTile
                  label="Delta"
                  value={delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${unit}`}
                  hint="observed − threshold"
                  tone={delta != null && delta < 0 ? 'critical' : 'neutral'}
                />
                <MetricTile
                  label="% of threshold"
                  value={breachPct == null ? '—' : `${breachPct}%`}
                  hint="current / threshold"
                  tone={breachPct != null && breachPct < 100 ? 'critical' : 'neutral'}
                />
                <MetricTile label="Age" value={formatAlertAge(row.detected_at)} hint={String(row.detected_at || '')} />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <Card className="space-y-3">
                    <PanelHeader
                      title="Investigation summary"
                      action={
                        <span className="flex flex-wrap gap-2">
                          <StatusBadge tone={severity === 'critical' ? 'critical' : 'warning'} label={String(row.severity || 'info')} />
                          <StatusBadge tone={stateTone(status.toLowerCase())} label={stateLabel(status)} />
                        </span>
                      }
                    />
                    <p className="text-sm leading-relaxed">{explainAlert(row, current, threshold)}</p>
                    <dl className="grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Resource</dt>
                        <dd className="mt-1">
                          <span className="text-xs text-muted-foreground">{text(row, 'resource_type')} · </span>
                          <span className="font-mono text-xs">{text(row, 'resource_id')}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Backend</dt>
                        <dd className="mt-1 space-y-1">
                          {backendId ? (
                            <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${backendId}`}>
                              {backend.data?.backend_name ? String(backend.data.backend_name) : backendId}
                            </Link>
                          ) : (
                            '—'
                          )}
                          {backend.data ? (
                            <p className="text-xs text-muted-foreground">
                              {String(backend.data.operational_status || '—')} · {String(backend.data.qubit_count ?? '—')} qubits ·{' '}
                              {String(backend.data.provider_id || '')}
                            </p>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Detected (UTC)</dt>
                        <dd className="mt-1 font-mono text-xs">{text(row, 'detected_at')}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Ack / resolve</dt>
                        <dd className="mt-1 text-xs">
                          {text(row, 'acknowledged_by')} · {text(row, 'resolved_at')}
                        </dd>
                      </div>
                    </dl>
                    <Notice tone="info">
                      QRP shows detector evidence for ops triage. Live qubit telemetry charts stay in Q-TeleScope — this page does not invent trends.
                    </Notice>
                  </Card>

                  <Card className="space-y-3">
                    <PanelHeader
                      title="Related on this resource"
                      action={
                        related.isError ? (
                          <span className="text-xs text-muted-foreground">Unavailable</span>
                        ) : (
                          <span className="text-xs text-muted-foreground tabular-nums">{relatedRows.length} other</span>
                        )
                      }
                    />
                    {related.isPending ? (
                      <div className="h-20 animate-pulse rounded-lg bg-muted" />
                    ) : relatedRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No other alerts on {resourceId || 'this resource'}.</p>
                    ) : (
                      <Table
                        rows={relatedRows.slice(0, 8)}
                        columns={[
                          {
                            key: 'alert_id',
                            label: 'Alert',
                            render: (r) => (
                              <Link className="font-medium text-primary hover:underline" to={`/qrp/support/${r.alert_id}`}>
                                {shortId(String(r.alert_id || ''), 12)}
                              </Link>
                            ),
                          },
                          {
                            key: 'severity',
                            label: 'Sev',
                            render: (r) => (
                              <StatusBadge
                                tone={String(r.severity).toLowerCase() === 'critical' ? 'critical' : 'warning'}
                                label={String(r.severity || '')}
                              />
                            ),
                          },
                          {
                            key: 'status',
                            label: 'Status',
                            render: (r) => (
                              <StatusBadge tone={stateTone(String(r.status || '').toLowerCase())} label={stateLabel(String(r.status || ''))} />
                            ),
                          },
                          {
                            key: 'current_value',
                            label: 'Value',
                            render: (r) => {
                              const v = Number(r.current_value)
                              return Number.isFinite(v) ? `${v.toFixed(1)}${unit}` : '—'
                            },
                          },
                          {
                            key: 'detected_at',
                            label: 'Age',
                            render: (r) => formatAlertAge(r.detected_at),
                          },
                        ]}
                      />
                    )}
                  </Card>

                  {incidentId ? (
                    <Card className="space-y-3">
                      <PanelHeader
                        title="Incident group"
                        action={
                          <Link className="text-xs font-medium text-primary hover:underline" to={`/qrp/incidents/${incidentId}`}>
                            Full incident
                          </Link>
                        }
                      />
                      {incident.isError ? (
                        <EmptyState title="Incident unavailable" body={message(incident.error)} />
                      ) : incident.isPending ? (
                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                      ) : (
                        <>
                          <p className="text-sm font-medium">{String(incident.data?.title || incidentId)}</p>
                          <p className="text-sm text-muted-foreground">{String(incident.data?.summary || '')}</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <StatusBadge
                              tone={String(incident.data?.severity).toLowerCase() === 'critical' ? 'critical' : 'warning'}
                              label={String(incident.data?.severity || '')}
                            />
                            <StatusBadge
                              tone={stateTone(String(incident.data?.status || '').toLowerCase())}
                              label={stateLabel(String(incident.data?.status || ''))}
                            />
                            <span className="rounded-md border border-border px-2 py-1 tabular-nums">
                              {String(incident.data?.alert_count ?? siblingOnBackend.length)} alerts grouped
                            </span>
                          </div>
                          {siblingOnBackend.length > 0 ? (
                            <Table
                              rows={siblingOnBackend}
                              columns={[
                                {
                                  key: 'alert_id',
                                  label: 'Sibling alert',
                                  render: (r) => (
                                    <Link className="font-medium text-primary hover:underline" to={`/qrp/support/${r.alert_id}`}>
                                      {shortId(String(r.alert_id || ''), 10)}
                                    </Link>
                                  ),
                                },
                                { key: 'resource_id', label: 'Resource' },
                                {
                                  key: 'current_value',
                                  label: 'Value',
                                  render: (r) => {
                                    const v = Number(r.current_value)
                                    return Number.isFinite(v) ? v.toFixed(1) : '—'
                                  },
                                },
                                {
                                  key: 'status',
                                  label: 'Status',
                                  render: (r) => (
                                    <StatusBadge
                                      tone={stateTone(String(r.status || '').toLowerCase())}
                                      label={stateLabel(String(r.status || ''))}
                                    />
                                  ),
                                },
                              ]}
                            />
                          ) : null}
                        </>
                      )}
                    </Card>
                  ) : (
                    <Notice tone="warning">Not linked to an incident yet. Grouping happens when the sync job attaches alerts.</Notice>
                  )}
                </div>

                <div className="space-y-4">
                  <Card className="space-y-3">
                    <PanelHeader title="Next actions" />
                    <ol className="list-decimal space-y-2 ps-4 text-sm text-muted-foreground">
                      <li>Confirm reading vs threshold above (source: alert detector).</li>
                      <li>Check sibling alerts on the same backend via the incident group.</li>
                      <li>Acknowledge to claim ownership, then add investigation notes.</li>
                      <li>Resolve only when the condition is cleared or accepted with a note.</li>
                    </ol>
                    <div className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
                      {backendId ? (
                        <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${backendId}`}>
                          Backend operational context →
                        </Link>
                      ) : null}
                      <Link className="font-medium text-primary hover:underline" to="/qrp/centre">
                        Operations Centre →
                      </Link>
                      <Link className="font-medium text-primary hover:underline" to="/qrp/queues">
                        Queues (if dispatch blocked) →
                      </Link>
                    </div>
                  </Card>

                  <Card className="space-y-3">
                    <PanelHeader title="Investigation trail" />
                    <div className="flex flex-wrap gap-2">
                      {status !== 'ACKNOWLEDGED' && status !== 'RESOLVED' && (
                        <button type="button" className={buttonClass} disabled={advance.isPending} onClick={() => advance.mutate('acknowledge')}>
                          Acknowledge
                        </button>
                      )}
                      {status !== 'RESOLVED' && (
                        <button type="button" className="btn-secondary" disabled={advance.isPending} onClick={() => advance.mutate('resolve')}>
                          Resolve
                        </button>
                      )}
                    </div>
                    {advance.error && <p className="text-sm text-critical">{message(advance.error)}</p>}
                    <form
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        comment.mutate()
                      }}
                    >
                      <label className="text-sm">
                        Note (saved on comment; also attached when you Ack/Resolve)
                        <textarea
                          required
                          className={`${fieldClass} min-h-[100px] w-full`}
                          value={note}
                          placeholder="What you checked, who you notified, why you ack/resolve…"
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </label>
                      <button type="submit" className={buttonClass} disabled={comment.isPending || !note.trim()}>
                        {comment.isPending ? 'Posting…' : 'Post to trail'}
                      </button>
                    </form>
                    {comment.error && <p className="text-sm text-critical">{message(comment.error)}</p>}
                    <ul className="divide-y divide-border/70 text-sm">
                      <li className="py-2 first:pt-0">
                        <span className="font-medium">System</span>
                        <span className="text-muted-foreground"> · {formatAlertAge(row.detected_at)}</span>
                        <p className="mt-0.5 text-muted-foreground">Detected · {text(row, 'detected_at')}</p>
                      </li>
                      {row.acknowledged_by ? (
                        <li className="py-2">
                          <span className="font-medium">{text(row, 'acknowledged_by')}</span>
                          <p className="mt-0.5 text-muted-foreground">Acknowledged</p>
                        </li>
                      ) : null}
                      {row.resolved_at ? (
                        <li className="py-2">
                          <span className="font-medium">Resolved</span>
                          <span className="text-muted-foreground"> · {text(row, 'resolved_at')}</span>
                        </li>
                      ) : null}
                      {comments.map((c) => (
                        <li key={String(c.comment_id)} className="py-2">
                          <span className="font-medium">{text(c, 'author')}</span>
                          <span className="text-muted-foreground">
                            {' '}
                            · {c.role ? `${String(c.role)} · ` : ''}
                            {formatAlertAge(c.created_at)}
                          </span>
                          <p className="mt-0.5 whitespace-pre-wrap">{text(c, 'text')}</p>
                        </li>
                      ))}
                      {comments.length === 0 && !row.acknowledged_by && (
                        <li className="py-2 text-muted-foreground">No operator notes yet. Post what you verified.</li>
                      )}
                    </ul>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </QueryBody>
      )}
    </Page>
  )
}

export function PoolsPage() {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['pools'],
    queryFn: () => qre<unknown>('/virtual-pools'),
  })
  const inventory = useQuery({
    queryKey: ['assets-pools'],
    queryFn: async () => asList(await qre<unknown>('/inventory/assets')),
    retry: false,
  })
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: () => qre('/virtual-pools', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      setName('')
      void client.invalidateQueries({ queryKey: ['pools'] })
    },
  })
  const all = asList(query.data)
  const rows = all.filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['name', 'pool_id', 'description'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const memberTotal = all.reduce((sum, row) => sum + (Number(row.member_count) || 0), 0)
  const emptyPools = all.filter((row) => Number(row.member_count || 0) === 0).length
  return (
    <Page
      eyebrow="Resources"
      title="Virtual pools"
      description="A pool groups assets. Membership does not reserve or dispatch them."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link className="btn-ghost" to="/qrp/inventory">
            Inventory
          </Link>
          <Link className="btn-ghost" to="/qrp/providers">
            Providers
          </Link>
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Pools" value={query.isError ? '—' : all.length} hint="Virtual groupings" />
        <MetricTile label="Members (sum)" value={query.isError ? '—' : memberTotal} hint="Across pools" />
        <MetricTile label="Empty pools" value={query.isError ? '—' : emptyPools} hint="No members yet" tone={emptyPools ? 'warning' : 'neutral'} />
        <MetricTile
          label="Inventory assets"
          value={inventory.isError ? '—' : (inventory.data?.length ?? 0)}
          hint="Available to attach"
        />
      </div>
      <Card>
        <PanelHeader title="Create pool" />
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <input required className={fieldClass} value={name} placeholder="Pool name" onChange={(e) => setName(e.target.value)} />
          <button type="submit" className={buttonClass} disabled={create.isPending}>
            Create
          </button>
        </form>
        {create.error && <p className="mt-2 text-sm text-critical">{message(create.error)}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Pools are labels for capacity planning — not holds, not dispatch.</p>
      </Card>
      <Card>
        <FilterBar
          options={[{ id: 'all', label: 'All' }]}
          value="all"
          onChange={() => undefined}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search pools…"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No pools"
            emptyBody="Create a pool, then add inventory members."
            columns={[
              {
                key: 'name',
                label: 'Pool',
                render: (row) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/pools/${row.pool_id}`}>
                    {text(row, 'name')}
                  </Link>
                ),
              },
              {
                key: 'pool_id',
                label: 'Id',
                render: (row) => <CopyableId value={String(row.pool_id || '')} />,
              },
              { key: 'member_count', label: 'Members', sortable: true },
              { key: 'description', label: 'Description' },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

function stageIndex(stage: string) {
  if (stage === 'I1') return 0
  if (stage === 'I2' || stage === 'suspended') return 1
  return 2
}

export function ProviderDetailPage() {
  const { providerId = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['providers'],
    queryFn: () => qre<unknown>('/providers'),
  })
  const row = asList(query.data).find((item) => item.provider_id === providerId)
  const integration = (row?.integration as Row | undefined) ?? {}
  const [operations, setOperations] = useState('observe,submit')
  const [classes, setClasses] = useState('hardware')
  const save = useMutation({
    mutationFn: () =>
      qre(`/providers/${encodeURIComponent(providerId)}/onboarding`, {
        method: 'POST',
        body: JSON.stringify({
          operations: operations.split(',').map((part) => part.trim()).filter(Boolean),
          execution_classes: classes.split(',').map((part) => part.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['providers'] }),
  })
  const move = useMutation({
    mutationFn: (status: string) =>
      qre(`/providers/${encodeURIComponent(providerId)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['providers'] }),
  })
  return (
    <Page
      eyebrow="Resources"
      title={String(row?.provider_name || providerId)}
      description="Publish a capability manifest, then set the provider active or suspended."
      steps={[
        { id: 'register', label: 'Register' },
        { id: 'manifest', label: 'Manifest' },
        { id: 'activate', label: 'Activate' },
      ]}
      stepIndex={stageIndex(String(integration.stage || 'I1'))}
      actions={
        <Link to="/qrp/providers" className="text-sm font-medium text-primary hover:underline">
          All providers
        </Link>
      }
    >
      <QueryBody query={query}>
        {row && (
          <>
            <Card className="space-y-2 text-sm">
              <StatusBadge tone={stateTone(String(row.status || 'active'))} label={stateLabel(String(row.status || 'active'))} />
              <p>Stage {text(integration, 'stage')}</p>
              <p>Operations {(integration.operations as string[] | undefined)?.join(', ') || '—'}</p>
              <div className="flex gap-2">
                {['active', 'suspended'].map((status) => (
                  <button key={status} type="button" className={buttonClass} disabled={move.isPending} onClick={() => move.mutate(status)}>
                    {stateLabel(status)}
                  </button>
                ))}
              </div>
              {move.error && <p className="text-critical">{message(move.error)}</p>}
            </Card>
            <Card>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  save.mutate()
                }}
              >
                <label className="text-sm">
                  Operations
                  <input className={fieldClass} value={operations} onChange={(event) => setOperations(event.target.value)} />
                </label>
                <label className="text-sm">
                  Execution classes
                  <input className={fieldClass} value={classes} onChange={(event) => setClasses(event.target.value)} />
                </label>
                <div>
                  <button type="submit" className={buttonClass} disabled={save.isPending}>
                    Publish manifest
                  </button>
                  {save.isSuccess && <p className="mt-2 text-sm text-success-text">Manifest saved.</p>}
                  {save.error && <p className="mt-2 text-sm text-critical">{message(save.error)}</p>}
                </div>
              </form>
            </Card>
          </>
        )}
        {!row && !query.isLoading && <Notice tone="warning">This provider is not in the catalogue.</Notice>}
      </QueryBody>
    </Page>
  )
}

export function PoolDetailPage() {
  const { poolId = '' } = useParams()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['pool', poolId],
    queryFn: () => qre<Row>(`/virtual-pools/${encodeURIComponent(poolId)}`),
    enabled: !!poolId,
  })
  const [assetId, setAssetId] = useState('')
  const add = useMutation({
    mutationFn: () =>
      qre(`/virtual-pools/${encodeURIComponent(poolId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ asset_id: assetId }),
      }),
    onSuccess: () => {
      setAssetId('')
      void client.invalidateQueries({ queryKey: ['pool', poolId] })
      void client.invalidateQueries({ queryKey: ['pools'] })
    },
  })
  const members = Array.isArray(query.data?.members) ? (query.data.members as Row[]) : []
  return (
    <Page
      eyebrow="Resources"
      title={String(query.data?.name || poolId)}
      description="Add a registered asset. Membership does not reserve the asset."
      actions={
        <Link to="/qrp/pools" className="text-sm font-medium text-primary hover:underline">
          All pools
        </Link>
      }
    >
      <QueryBody query={query}>
        <Card>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              add.mutate()
            }}
          >
            <input required className={fieldClass} value={assetId} placeholder="Asset id" onChange={(event) => setAssetId(event.target.value)} />
            <button type="submit" className={buttonClass} disabled={add.isPending}>
              Add
            </button>
          </form>
          {add.error && <p className="mt-2 text-sm text-critical">{message(add.error)}</p>}
        </Card>
        <Card>
          <Table
            rows={members}
            columns={[
              {
                key: 'native_asset_id',
                label: 'Asset',
                render: (member) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/inventory/${member.asset_id}`}>
                    {text(member, 'native_asset_id')}
                  </Link>
                ),
              },
              { key: 'execution_class', label: 'Execution' },
              { key: 'lifecycle_state', label: 'Lifecycle' },
            ]}
          />
        </Card>
      </QueryBody>
    </Page>
  )
}

export function ConnectorsPage() {
  const [stage, setStage] = useState('all')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['connectors'],
    queryFn: () => qre<Row>('/connectors'),
  })
  const legend = (query.data?.legend as Row | undefined) ?? {}
  const all = asList(query.data)
  const stageOptions = useMemo(() => {
    const ids = Array.from(
      new Set(all.map((row) => String(((row.integration as Row | undefined) ?? {}).stage || '')).filter(Boolean)),
    ).sort()
    return [{ id: 'all', label: 'All stages' }, ...ids.map((id) => ({ id, label: id }))]
  }, [all])
  const rows = all.filter((row) => {
    const integ = (row.integration as Row | undefined) ?? {}
    if (stage !== 'all' && String(integ.stage || '') !== stage) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [String(row.provider_name ?? ''), String(row.provider_id ?? ''), String(integ.stage ?? '')].some((v) =>
      v.toLowerCase().includes(q),
    )
  })
  const collectorOk = all.filter((row) => String(((row.integration as Row | undefined) ?? {}).collector_last_status || '').toUpperCase() === 'OK').length
  const circuitOpen = all.filter((row) => Boolean(((row.integration as Row | undefined) ?? {}).circuit_open)).length
  const backendsDetected = all.reduce(
    (sum, row) => sum + (Number(((row.integration as Row | undefined) ?? {}).collector_backends_detected) || 0),
    0,
  )
  const stageChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(((row.integration as Row | undefined) ?? {}).stage || '—')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [all])
  return (
    <Page
      eyebrow="Resources"
      title="Connectors"
      description="Integration stage is evidence on file. I5 is not claimed until a reconciled dispatch exists. No live connection test endpoint."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link className="btn-ghost" to="/qrp/providers">
            Providers
          </Link>
          <Link className="btn-ghost" to="/qrp/reconciliation">
            Reconciliation
          </Link>
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Connectors" value={query.isError ? '—' : all.length} hint="Mirrors providers" />
        <MetricTile label="Collector OK" value={query.isError ? '—' : collectorOk} hint="Last status" tone="success" />
        <MetricTile label="Backends detected" value={query.isError ? '—' : backendsDetected} hint="Sum of last runs" />
        <MetricTile label="Circuit open" value={query.isError ? '—' : circuitOpen} hint="Breaker state" tone={circuitOpen ? 'critical' : 'neutral'} />
      </div>
      <QueryBody query={query}>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <PanelHeader title="Stage mix" />
            {stageChart.length === 0 ? (
              <EmptyState title="No connectors" body="Empty catalogue." />
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stageChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                      {stageChart.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card className="xl:col-span-2 space-y-1 text-sm">
            <PanelHeader title="Stage legend" />
            {Object.keys(legend).length === 0 ? (
              <p className="text-muted-foreground">Legend missing from `/connectors`.</p>
            ) : (
              Object.entries(legend).map(([key, value]) => (
                <p key={key}>
                  <span className="font-mono font-medium">{key}</span> <span className="text-muted-foreground">{String(value)}</span>
                </p>
              ))
            )}
          </Card>
        </div>
        <Card>
          <FilterBar
            options={stageOptions}
            value={stage}
            onChange={setStage}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search connectors…"
            defaultId="all"
          />
          <Table
            rows={rows}
            emptyTitle="No connectors"
            emptyBody="Connector rows mirror the provider catalogue."
            columns={[
              {
                key: 'provider_name',
                label: 'Provider',
                render: (row) =>
                  row.provider_id ? (
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/providers/${row.provider_id}`}>
                      {text(row, 'provider_name') === '—' ? text(row, 'provider_id') : text(row, 'provider_name')}
                    </Link>
                  ) : (
                    text(row, 'provider_name')
                  ),
              },
              {
                key: 'provider_id',
                label: 'Id',
                render: (row) => <CopyableId value={String(row.provider_id || '')} />,
              },
              {
                key: 'stage',
                label: 'Stage',
                render: (row) => (
                  <StatusBadge tone="neutral" label={text((row.integration as Row | undefined) ?? {}, 'stage')} />
                ),
              },
              {
                key: 'collector',
                label: 'Collector',
                render: (row) => {
                  const status = text((row.integration as Row | undefined) ?? {}, 'collector_last_status')
                  return status === '—' ? <span className="text-muted-foreground">Unavailable</span> : status
                },
              },
              {
                key: 'backends',
                label: 'Detected',
                render: (row) => (
                  <span className="tabular-nums">
                    {text((row.integration as Row | undefined) ?? {}, 'collector_backends_detected')}
                  </span>
                ),
              },
              {
                key: 'circuit',
                label: 'Circuit',
                render: (row) => (((row.integration as Row | undefined) ?? {}).circuit_open ? 'open' : 'closed'),
              },
              {
                key: 'last_run',
                label: 'Last run',
                render: (row) => (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {text((row.integration as Row | undefined) ?? {}, 'collector_last_run_at')}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </QueryBody>
    </Page>
  )
}

export function DispatchPage() {
  const query = useQuery({
    queryKey: ['dispatch-icd'],
    queryFn: () => qre<Row>('/dispatch-icd'),
  })
  const attempts = useQuery({
    queryKey: ['dispatch-attempts-icd'],
    queryFn: () => qre<unknown>('/dispatch-attempts'),
    retry: false,
  })
  const jobs = useQuery({
    queryKey: ['jobs-icd'],
    queryFn: () => qre<unknown>('/jobs?limit=50'),
    retry: false,
  })
  const outcomes = Array.isArray(query.data?.reconcile_outcomes) ? (query.data.reconcile_outcomes as string[]) : []
  const required = Array.isArray(query.data?.required_fields) ? (query.data.required_fields as string[]) : []
  const attemptRows = asList(attempts.data)
  const unresolved = attemptRows.filter((row) => {
    const state = String(row.dispatch_state || '')
    return state === 'dispatch_unresolved' || state === 'dispatch_authorized'
  }).length
  const confirmed = attemptRows.filter((row) => row.dispatch_state === 'dispatch_confirmed').length
  const jobRows = asList(jobs.data)
  return (
    <Page
      eyebrow="Operations · Contract"
      title="Dispatch & Jobs"
      description="ICD contract for authorise/reconcile, plus live attempt and provider-job posture. Operator work happens on Reconciliation / Jobs."
      actions={
        <span className="flex flex-wrap gap-2">
          <Link to="/qrp/reconciliation" className="btn-primary">
            Open reconciliation
          </Link>
          <Link to="/qrp/jobs" className="btn-secondary">
            Provider jobs
          </Link>
          <Link to="/qrp/connectors" className="btn-ghost">
            Connectors
          </Link>
        </span>
      }
    >
      <Notice tone="info">Use Reconciliation for G3 attempts. ICD below is the contract — not a live connector console.</Notice>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="ICD version" value={query.isError ? '—' : text(query.data ?? {}, 'icd_version')} hint="Contract" />
        <MetricTile
          label="Live connector"
          value={query.isError ? '—' : query.data?.live_connector ? 'Claimed' : 'Off'}
          hint="I5 claim flag"
          tone={query.data?.live_connector ? 'success' : 'neutral'}
        />
        <MetricTile
          label="Needs reconcile"
          value={attempts.isError ? '—' : unresolved}
          hint="Authorized / unresolved"
          tone={unresolved ? 'critical' : 'neutral'}
        />
        <MetricTile label="Provider jobs (sample)" value={jobs.isError ? '—' : jobRows.length} hint="Latest /jobs?limit=50" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <QueryBody query={query}>
          <Card className="space-y-3 text-sm">
            <PanelHeader title="ICD endpoints" />
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Reconcile outcomes</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {outcomes.length
                    ? outcomes.map((o) => <StatusBadge key={o} tone="neutral" label={o} />)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Confirmed attempts</dt>
                <dd className="mt-1 tabular-nums font-medium">{attempts.isError ? '—' : confirmed}</dd>
              </div>
            </dl>
            <p className="font-mono text-xs text-muted-foreground">{text(query.data ?? {}, 'authorize_dispatch')}</p>
            <p className="font-mono text-xs text-muted-foreground">{text(query.data ?? {}, 'record_attempt')}</p>
            <p className="font-mono text-xs text-muted-foreground">{text(query.data ?? {}, 'reconcile')}</p>
            <p className="text-muted-foreground">{text(query.data ?? {}, 'notes')}</p>
            {required.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Required fields</p>
                <ul className="mt-1 list-inside list-disc font-mono text-xs text-muted-foreground">
                  {required.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </QueryBody>
        <Card>
          <PanelHeader
            title="Operator path"
            action={
              <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/jobs">
                Jobs list
              </Link>
            }
          />
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Approve workload on Review Queue.</li>
            <li>Authorise + record attempt (governance handoff).</li>
            <li>Reconcile outcome on Reconciliation — never blind retry.</li>
            <li>Cross-check provider job status when external_job_id exists.</li>
          </ol>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <MetricTile label="Failed jobs (sample)" value={jobRows.filter((r) => String(r.status || '').toUpperCase() === 'FAILED').length} hint="Provider-reported" tone="warning" />
            <MetricTile label="Running (sample)" value={jobRows.filter((r) => String(r.status || '').toUpperCase() === 'RUNNING').length} hint="Provider-reported" />
          </div>
        </Card>
      </div>
    </Page>
  )
}

export function UsersPage() {
  const client = useQueryClient()
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => qre<unknown>('/users'),
  })
  const catalog = useQuery({
    queryKey: ['role-catalog'],
    queryFn: () => qre<{ roles?: { id: string; label: string }[] }>('/users/roles/catalog'),
  })
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('Operator')
  const save = useMutation({
    mutationFn: () =>
      qre(`/users/${encodeURIComponent(username)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      setUsername('')
      void client.invalidateQueries({ queryKey: ['users'] })
    },
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
      eyebrow="Workspace"
      title="Users & Roles"
      description="Institution directory and QRP role assignment. QRP does not manage local passwords or MFA enrollment here."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link to="/qrp/audit" className="btn-ghost">
            Audit log
          </Link>
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Users" value={query.isError ? '—' : all.length} hint="Directory" />
        <MetricTile label="Roles in use" value={query.isError ? '—' : roleChart.length} hint="Distinct role values" />
        <MetricTile label="Orgs" value={query.isError ? '—' : orgs} hint="Distinct org field" />
        <MetricTile label="MFA flagged" value={query.isError ? '—' : mfaOn} hint="mfa_enabled from directory" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <PanelHeader title="Role distribution" />
          {roleChart.length === 0 ? (
            <EmptyState title="No users" body="Directory empty." />
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleChart} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2}>
                    {roleChart.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <PanelHeader title="Assign role" />
          <form
            className="mt-2 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!window.confirm(`Assign role ${role} to ${username}?`)) return
              save.mutate()
            }}
          >
            <input required className={`${fieldClass} min-w-40 flex-1`} value={username} placeholder="Username" onChange={(event) => setUsername(event.target.value)} />
            <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value)}>
              {roles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.id})
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass} disabled={save.isPending}>
              Assign role
            </button>
            {save.error && <p className="w-full text-sm text-critical">{message(save.error)}</p>}
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Role changes append to Audit Trail. Catalog has {roles.length} assignable roles.</p>
        </Card>
      </div>
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
            emptyBody="Directory empty for this tenant."
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
    </Page>
  )
}

export function IncidentsPage() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['incidents'],
    queryFn: () => qre<unknown>('/incidents?limit=50'),
  })
  const alertSummary = useQuery({
    queryKey: ['alerts-summary-incidents'],
    queryFn: () => qre<Row>('/alerts/summary'),
    retry: false,
  })
  const all = asList(query.data)
  const statusOptions = useMemo(() => {
    const source = asList(query.data)
    const ids = Array.from(new Set(source.map((row) => String(row.status || '').toLowerCase()).filter(Boolean))).sort()
    return [{ id: 'all', label: 'All status' }, ...ids.map((id) => ({ id, label: stateLabel(id) }))]
  }, [query.data])
  const rows = all.filter((row) => {
    if (status !== 'all' && String(row.status || '').toLowerCase() !== status) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['title', 'incident_id', 'status', 'severity', 'backend_id'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const openCount = all.filter((row) => String(row.status || '').toLowerCase() === 'open').length
  const criticalCount = all.filter((row) => String(row.severity || '').toLowerCase() === 'critical').length
  const alertTotal = all.reduce((sum, row) => sum + (Number(row.alert_count) || 0), 0)
  return (
    <Page
      eyebrow="Operations"
      title="Incidents"
      description="Incidents group related alerts into cases. Prefer these over scrolling 80+ qubit rows."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link to="/qrp/support" className="btn-secondary">
            Active alerts
          </Link>
          <Link to="/qrp/centre" className="btn-ghost">
            Ops centre
          </Link>
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Listed" value={query.isError ? '—' : all.length} hint="Latest sync sample" />
        <MetricTile label="Open" value={query.isError ? '—' : openCount} hint="Needs triage" tone={openCount ? 'critical' : 'neutral'} />
        <MetricTile label="Critical severity" value={query.isError ? '—' : criticalCount} hint="Among listed" tone={criticalCount ? 'critical' : 'neutral'} />
        <MetricTile
          label="Linked alerts"
          value={query.isError ? '—' : alertTotal || alertSummary.data?.active}
          hint={alertSummary.isError ? 'From incident rows' : `${String(alertSummary.data?.active ?? '—')} active fleet-wide`}
          tone="warning"
        />
      </div>
      <Card>
        <FilterBar
          options={statusOptions}
          value={status}
          onChange={setStatus}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search incidents…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No incidents"
            emptyBody={search || status !== 'all' ? 'No rows match filters.' : 'Incidents appear when triage opens a case.'}
            columns={[
              {
                key: 'title',
                label: 'Incident',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/incidents/${row.incident_id}`}>
                      {text(row, 'title')}
                    </Link>
                    <CopyableId value={String(row.incident_id || '')} keep={10} />
                  </span>
                ),
              },
              {
                key: 'backend_id',
                label: 'Backend',
                render: (row) =>
                  row.backend_id ? (
                    <Link className="hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'severity',
                label: 'Severity',
                render: (row) => (
                  <StatusBadge
                    tone={String(row.severity || '').toLowerCase() === 'critical' ? 'critical' : 'warning'}
                    label={String(row.severity || '—')}
                  />
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.status || '').toLowerCase())} label={stateLabel(String(row.status || 'open'))} />
                ),
              },
              { key: 'alert_count', label: 'Alerts', sortable: true },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function IncidentDetailPage() {
  const { incidentId = '' } = useParams()
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const query = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => qre<Row>(`/incidents/${encodeURIComponent(incidentId)}`),
    enabled: !!incidentId,
  })
  const act = useMutation({
    mutationFn: (action: 'acknowledge' | 'investigate' | 'resolve') =>
      qre(`/incidents/${encodeURIComponent(incidentId)}/${action}`, {
        method: 'POST',
        body: JSON.stringify(
          action === 'investigate' ? {} : action === 'acknowledge' ? { comment: note || undefined } : { resolution_notes: note },
        ),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['incident', incidentId] }),
  })
  const status = String(query.data?.status || 'OPEN')
  const alerts = Array.isArray(query.data?.alerts) ? (query.data.alerts as Row[]) : []
  return (
    <Page
      eyebrow="Operations"
      title={String(query.data?.title || incidentId)}
      description={String(query.data?.summary || 'Incident detail')}
      actions={
        <Link to="/qrp/incidents" className="text-sm font-medium text-primary hover:underline">
          All incidents
        </Link>
      }
    >
      <QueryBody query={query}>
        {query.data && (
          <>
            <Card className="space-y-3">
              <StatusBadge tone={stateTone(status.toLowerCase())} label={stateLabel(status)} />
              <p className="text-sm text-muted-foreground">
                {text(query.data, 'backend_id')} · owner {text(query.data, 'owner')}
              </p>
              <input className={fieldClass} value={note} placeholder="Note" onChange={(event) => setNote(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                {status !== 'RESOLVED' && status !== 'ACKNOWLEDGED' && status !== 'INVESTIGATING' && (
                  <button type="button" className={buttonClass} disabled={act.isPending} onClick={() => act.mutate('acknowledge')}>
                    Acknowledge
                  </button>
                )}
                {status !== 'RESOLVED' && status !== 'INVESTIGATING' && (
                  <button type="button" className={buttonClass} disabled={act.isPending} onClick={() => act.mutate('investigate')}>
                    Investigate
                  </button>
                )}
                {status !== 'RESOLVED' && (
                  <button type="button" className={buttonClass} disabled={act.isPending} onClick={() => act.mutate('resolve')}>
                    Resolve
                  </button>
                )}
              </div>
              {act.error && <p className="text-sm text-critical">{message(act.error)}</p>}
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-semibold">Linked alerts</h2>
              <Table
                rows={alerts}
                columns={[
                  {
                    key: 'alert_id',
                    label: 'Alert',
                    render: (row) => (
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/support/${row.alert_id}`}>
                        {text(row, 'alert_id')}
                      </Link>
                    ),
                  },
                  { key: 'severity', label: 'Severity' },
                  { key: 'status', label: 'Status' },
                  { key: 'message', label: 'Message' },
                ]}
              />
            </Card>
          </>
        )}
      </QueryBody>
    </Page>
  )
}

const JOB_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'RUNNING', label: 'Running' },
  { id: 'QUEUED', label: 'Queued' },
  { id: 'FAILED', label: 'Failed' },
] as const

export function JobsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof JOB_STATUS_FILTERS)[number]['id']>('all')
  const query = useQuery({
    queryKey: ['jobs'],
    queryFn: () => qre<unknown>('/jobs?limit=50'),
  })
  const all = asList(query.data)
  const rows = all.filter((row) => {
    if (status !== 'all' && String(row.status || '').toUpperCase() !== status) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['job_id', 'backend_id', 'status', 'failure_category_label'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const completed = all.filter((r) => String(r.status || '').toUpperCase() === 'COMPLETED').length
  const failed = all.filter((r) => String(r.status || '').toUpperCase() === 'FAILED').length
  const running = all.filter((r) => String(r.status || '').toUpperCase() === 'RUNNING').length
  const queued = all.filter((r) => String(r.status || '').toUpperCase() === 'QUEUED').length
  const statusChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.status || 'UNKNOWN').toUpperCase()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [all])
  const backendChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.backend_id || 'unknown')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name: name.slice(0, 16), value, full: name }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [all])
  return (
    <Page
      eyebrow="Operations"
      title="Provider jobs"
      description="Provider execution records (TeleScope job catalogue). Not QRP governance approval state — use Approvals for that."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link className="btn-ghost" to="/qrp/dispatch">
            Dispatch ICD
          </Link>
          <Link className="btn-ghost" to="/qrp/approvals">
            Approvals
          </Link>
          <Link className="btn-ghost" to="/qrp/reconciliation">
            Reconciliation
          </Link>
        </span>
      }
    >
      <Notice tone="info">
        Provider status ≠ governance approval. Cross-link via reconciliation when an external_job_id is recorded.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Listed" value={query.isError ? '—' : all.length} hint="Sample limit 50" />
        <MetricTile label="Queued" value={query.isError ? '—' : queued} hint="Provider-reported" />
        <MetricTile label="Running" value={query.isError ? '—' : running} hint="Provider-reported" tone="primary" />
        <MetricTile label="Completed" value={query.isError ? '—' : completed} hint="Provider-reported" tone="success" />
        <MetricTile label="Failed" value={query.isError ? '—' : failed} hint="Provider-reported" tone="warning" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <PanelHeader title="Status mix" />
          {statusChart.length === 0 ? (
            <EmptyState title="No jobs" body="Empty provider sample." />
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2}>
                    {statusChart.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <PanelHeader title="Jobs by backend" />
          {backendChart.length === 0 ? (
            <EmptyState title="No backends" body="Empty sample." />
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={backendChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(_, p) => String((p?.[0]?.payload as { full?: string } | undefined)?.full || '')} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
      <Card>
        <FilterBar
          options={JOB_STATUS_FILTERS}
          value={status}
          onChange={(id) => setStatus(id as (typeof JOB_STATUS_FILTERS)[number]['id'])}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search jobs…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No provider jobs"
            emptyBody={search || status !== 'all' ? 'No rows match filters.' : 'Execution records appear after backends report jobs.'}
            columns={[
              {
                key: 'job_id',
                label: 'Job',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/jobs/${row.job_id}`}>
                      {shortId(String(row.job_id || ''), 14)}
                    </Link>
                    <CopyableId value={String(row.job_id || '')} />
                  </span>
                ),
              },
              {
                key: 'backend_id',
                label: 'Backend',
                render: (row) =>
                  row.backend_id ? (
                    <Link className="hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'status',
                label: 'Provider status',
                sortable: true,
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.status || '').toLowerCase())} label={stateLabel(String(row.status || 'unknown'))} />
                ),
              },
              { key: 'runtime', label: 'Runtime' },
              { key: 'failure_category_label', label: 'Failure', sortable: true },
              {
                key: 'submitted_at',
                label: 'Submitted',
                sortable: true,
                render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{text(row, 'submitted_at')}</span>,
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function JobDetailPage() {
  const { jobId = '' } = useParams()
  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => qre<Row>(`/jobs/${encodeURIComponent(jobId)}`),
    enabled: !!jobId,
  })
  const status = String(query.data?.status || '')
  return (
    <Page
      eyebrow="Operations · Provider job"
      title={status ? stateLabel(status) : 'Provider job'}
      description={`Provider execution ${shortId(jobId, 14)}. Does not resubmit. Not a governance approval record.`}
      actions={
        <span className="flex flex-wrap gap-2">
          <CopyableId value={jobId} keep={16} />
          <Link to="/qrp/jobs" className="btn-secondary">
            All jobs
          </Link>
          <Link to="/qrp/metering" className="btn-ghost">
            Metering
          </Link>
        </span>
      }
    >
      <QueryBody query={query}>
        {query.data && (
          <Card className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Provider status</span>
              <StatusBadge tone={stateTone(status.toLowerCase())} label={stateLabel(status || 'unknown')} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Backend</dt>
                <dd className="mt-1 font-medium">
                  {query.data.backend_id ? (
                    <Link className="text-primary hover:underline" to={`/qrp/backends/${query.data.backend_id}`}>
                      {text(query.data, 'backend_id')}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Runtime</dt>
                <dd className="mt-1 font-medium">{text(query.data, 'runtime')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Failure</dt>
                <dd className="mt-1">{text(query.data, 'failure_category_label')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Submitted</dt>
                <dd className="mt-1 text-muted-foreground">{text(query.data, 'submitted_at')}</dd>
              </div>
            </dl>
            <p>{text(query.data, 'failure_reason')}</p>
            <Notice tone="info">
              Meter samples are not attached to this job schema. Open Metering for rollups; missing meter data is not zero.
            </Notice>
          </Card>
        )}
      </QueryBody>
    </Page>
  )
}

export function CentrePage() {
  const query = useQuery({
    queryKey: ['operations-centre'],
    queryFn: () => qre<Row>('/operations/centre'),
  })
  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
  })
  const attempts = useQuery({
    queryKey: ['dispatch-attempts-centre'],
    queryFn: () => qre<unknown>('/dispatch-attempts'),
    retry: false,
  })
  const queues = useQuery({
    queryKey: ['queues-centre'],
    queryFn: () => qre<unknown>('/queues'),
    retry: false,
  })
  const fleet = (query.data?.fleet as Row | undefined) ?? {}
  const ops = (query.data?.operations as Row | undefined) ?? {}
  const platform = (query.data?.data_platform as Row | undefined) ?? {}
  const collectors = (query.data?.collectors as Row | undefined) ?? {}
  const providers = Array.isArray(collectors.providers) ? (collectors.providers as Row[]) : []
  const backendsSnap = Array.isArray(query.data?.backends_snapshot) ? (query.data.backends_snapshot as Row[]) : []
  const classical = Array.isArray(query.data?.classical_hpc) ? (query.data.classical_hpc as Row[]) : []
  const unresolved = asList(attempts.data).filter((row) => {
    const state = String(row.dispatch_state || '')
    return state === 'dispatch_unresolved' || state === 'dispatch_authorized'
  }).length
  const queueRows = asList(queues.data)
  const pendingTotal = queueRows.reduce((sum, row) => sum + (Number(row.pending_jobs) || 0), 0)
  const fleetChart = useMemo(
    () =>
      [
        { name: 'Online', value: Number(fleet.online ?? 0), fill: 'var(--chart-4)' },
        { name: 'Offline', value: Number(fleet.offline ?? 0), fill: 'var(--chart-5)' },
        { name: 'Other', value: Number(fleet.maintenance_or_other ?? 0), fill: 'var(--chart-3)' },
      ].filter((d) => d.value > 0),
    [fleet.online, fleet.offline, fleet.maintenance_or_other],
  )
  const pendingChart = useMemo(() => {
    const rows = asList(queues.data)
    return rows
      .map((row) => ({
        name: String(row.backend_name || row.backend_id || '?').slice(0, 16),
        value: Number(row.pending_jobs) || 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [queues.data])
  return (
    <Page
      eyebrow="Operations"
      title="Operations Centre"
      description="Fleet posture, collector health, queue depth, and open exceptions. Not a TeleScope live console."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link className="btn-primary" to="/qrp/approvals">
            Approvals
          </Link>
          <Link className="btn-secondary" to="/qrp/reconciliation">
            Reconciliation
          </Link>
          <Link className="btn-ghost" to="/qrp/queues">
            Queues
          </Link>
          <Link className="btn-ghost" to="/qrp/support">
            Alerts
          </Link>
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          label="Approval queue"
          value={summary.isError ? '—' : summary.data?.queue}
          hint={summary.isError ? 'Summary unavailable' : 'Waiting on policy'}
          tone="primary"
        />
        <MetricTile
          label="Reconcile backlog"
          value={attempts.isError ? '—' : unresolved}
          hint={attempts.isError ? 'Attempts unavailable' : 'Authorized or unresolved'}
          tone={unresolved > 0 ? 'critical' : 'neutral'}
        />
        <MetricTile
          label="Pending jobs"
          value={queues.isError ? '—' : pendingTotal}
          hint="Sum of queue samples"
          tone={pendingTotal > 0 ? 'warning' : 'neutral'}
        />
        <MetricTile
          label="Active alerts"
          value={query.isError ? '—' : ops.active_alerts}
          hint="Fleet alerts"
          tone={Number(ops.active_alerts || 0) > 0 ? 'warning' : 'neutral'}
        />
        <MetricTile
          label="Open incidents"
          value={query.isError ? '—' : ops.open_incidents}
          hint="Tracked cases"
          tone={Number(ops.open_incidents || 0) > 0 ? 'critical' : 'neutral'}
        />
      </div>
      <QueryBody query={query}>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <PanelHeader title="Fleet reachability" />
            {fleetChart.length === 0 ? (
              <EmptyState title="No fleet sample" body="Centre returned empty fleet counts." />
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={fleetChart} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2}>
                      {fleetChart.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-1 text-center text-sm tabular-nums">
              {String(fleet.online ?? '—')}/{String(fleet.total ?? '—')} online
              {fleet.simulated_catalog != null ? ` · ${String(fleet.simulated_catalog)} simulated` : ''}
            </p>
          </Card>
          <Card className="xl:col-span-2">
            <PanelHeader
              title="Queue pending by backend"
              action={
                <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/queues">
                  Queues
                </Link>
              }
            />
            {queues.isError ? (
              <EmptyState title="Queues unavailable" body={message(queues.error)} />
            ) : pendingChart.length === 0 ? (
              <EmptyState title="No queue samples" body="Telemetry not ingested yet." />
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pendingChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={48} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Backends" value={fleet.total} hint="Registered in catalogue" />
          <MetricTile label="Online" value={fleet.online} hint="Currently reachable" tone="success" />
          <MetricTile label="Assets (gov)" value={summary.data?.inventory_assets} hint="From governance summary" />
          <MetricTile label="Providers active" value={summary.data?.providers_active} hint="Catalogue active" />
        </div>

        <Card className="text-sm text-muted-foreground">
          Generated {text(query.data ?? {}, 'generated_at')} · mode {text(platform, 'platform_data_mode')} · storage{' '}
          {text(platform, 'database_storage')}
          {platform.enable_mock_data != null ? ` · mock ${String(platform.enable_mock_data)}` : ''}
          {collectors.failed_or_stale != null ? ` · failed/stale collectors ${String(collectors.failed_or_stale)}` : ''}
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <PanelHeader title="Collector providers" />
            <Table
              rows={providers}
              emptyTitle="No collector runs"
              emptyBody="Provider ingest status appears after collectors run."
              columns={[
                { key: 'provider_id', label: 'Provider' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => (
                    <StatusBadge
                      tone={String(row.status || '').toUpperCase() === 'OK' ? 'success' : 'warning'}
                      label={String(row.status || '—')}
                    />
                  ),
                },
                { key: 'backends_detected', label: 'Backends' },
                { key: 'lineage', label: 'Lineage' },
                {
                  key: 'duration_ms',
                  label: 'ms',
                  render: (row) => (
                    <span className="tabular-nums">
                      {row.duration_ms == null ? '—' : Math.round(Number(row.duration_ms))}
                    </span>
                  ),
                },
                {
                  key: 'last_success_at',
                  label: 'Last OK',
                  render: (row) => (
                    <span className="font-mono text-[11px] text-muted-foreground">{text(row, 'last_success_at')}</span>
                  ),
                },
              ]}
            />
          </Card>
          <Card>
            <PanelHeader
              title="Catalogue snapshot"
              action={
                <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/backends">
                  Backends
                </Link>
              }
            />
            <Table
              rows={backendsSnap}
              emptyTitle="No snapshot"
              emptyBody="Centre backends_snapshot empty."
              columns={[
                {
                  key: 'backend_name',
                  label: 'Backend',
                  render: (row) => (
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_name')}
                    </Link>
                  ),
                },
                { key: 'provider_id', label: 'Provider' },
                { key: 'qpu_modality', label: 'Modality' },
                {
                  key: 'operational_status',
                  label: 'Status',
                  render: (row) => (
                    <StatusBadge
                      tone={stateTone(String(row.operational_status || '').toLowerCase())}
                      label={stateLabel(String(row.operational_status || 'unknown'))}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </div>

        {classical.length > 0 && (
          <Card>
            <PanelHeader title="Classical HPC hosts" />
            <p className="mb-3 text-xs text-muted-foreground">Host metrics for sim backends — not QPU cryo readings.</p>
            <Table
              rows={classical}
              emptyTitle="No classical samples"
              emptyBody="Sim backends with HPC telemetry appear here."
              columns={[
                {
                  key: 'backend_name',
                  label: 'Backend',
                  render: (row) => (
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_name')}
                    </Link>
                  ),
                },
                { key: 'hpc_cluster', label: 'Cluster' },
                {
                  key: 'cpu_util_pct',
                  label: 'CPU %',
                  render: (row) => <span className="tabular-nums">{text(row, 'cpu_util_pct')}</span>,
                },
                {
                  key: 'gpu_util_pct',
                  label: 'GPU %',
                  render: (row) => <span className="tabular-nums">{text(row, 'gpu_util_pct')}</span>,
                },
                {
                  key: 'mpi_ranks_active',
                  label: 'MPI ranks',
                  render: (row) => <span className="tabular-nums">{text(row, 'mpi_ranks_active')}</span>,
                },
                {
                  key: 'simulation_queue_depth',
                  label: 'Sim queue',
                  render: (row) => <span className="tabular-nums">{text(row, 'simulation_queue_depth')}</span>,
                },
              ]}
            />
          </Card>
        )}

        <Card>
          <PanelHeader
            title="Open incidents"
            action={
              <Link className="btn-ghost" to="/qrp/incidents">
                View all
              </Link>
            }
          />
          <Table
            rows={asList(query.data?.incidents)}
            emptyTitle="No open incidents"
            emptyBody="Fleet incidents appear here when triage opens a case."
            columns={[
              {
                key: 'title',
                label: 'Incident',
                render: (row) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/incidents/${row.incident_id}`}>
                    {text(row, 'title')}
                  </Link>
                ),
              },
              { key: 'backend_id', label: 'Backend' },
              {
                key: 'severity',
                label: 'Severity',
                render: (row) => (
                  <StatusBadge
                    tone={String(row.severity || '').toLowerCase() === 'critical' ? 'critical' : 'warning'}
                    label={String(row.severity || '—')}
                  />
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.status || '').toLowerCase())} label={stateLabel(String(row.status || 'open'))} />
                ),
              },
              {
                key: 'last_detected_at',
                label: 'Last seen',
                render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{text(row, 'last_detected_at')}</span>,
              },
            ]}
          />
        </Card>
      </QueryBody>
    </Page>
  )
}

export function BackendsPage() {
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('all')
  const query = useQuery({
    queryKey: ['backends'],
    queryFn: () => qre<unknown>('/backends'),
  })
  const queues = useQuery({
    queryKey: ['queues-backends'],
    queryFn: () => qre<unknown>('/queues'),
    retry: false,
  })
  const all = asList(query.data)
  const queueById = useMemo(() => {
    const map = new Map<string, Row>()
    for (const row of asList(queues.data)) map.set(String(row.backend_id || ''), row)
    return map
  }, [queues.data])
  const providers = Array.from(new Set(all.map((row) => String(row.provider_id || '')).filter(Boolean))).sort()
  const providerOptions = [{ id: 'all', label: 'All providers' }, ...providers.map((id) => ({ id, label: id }))]
  const rows = all.filter((row) => {
    if (provider !== 'all' && String(row.provider_id || '') !== provider) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['backend_name', 'backend_id', 'provider_id', 'operational_status', 'qpu_modality'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const online = all.filter((row) => String(row.operational_status || '').toUpperCase() === 'ONLINE').length
  const qubitTotal = all.reduce((sum, row) => sum + (Number(row.qubit_count) || 0), 0)
  const pendingTotal = asList(queues.data).reduce((sum, row) => sum + (Number(row.pending_jobs) || 0), 0)
  return (
    <Page
      eyebrow="Operations"
      title="Backends"
      description="Catalogue QPUs. Operational status is provider/catalogue state — not QRP governance eligibility or live dispatch claim."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link className="btn-ghost" to="/qrp/queues">
            Queues
          </Link>
          <Link className="btn-ghost" to="/qrp/centre">
            Ops centre
          </Link>
          <Link className="btn-ghost" to="/qrp/inventory">
            Inventory
          </Link>
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Catalogue" value={query.isError ? '—' : all.length} hint={`${providers.length} providers`} />
        <MetricTile label="Online" value={query.isError ? '—' : online} hint="Catalogue ONLINE" tone="success" />
        <MetricTile label="Qubits (sum)" value={query.isError ? '—' : qubitTotal} hint="Catalogue qubit_count" />
        <MetricTile
          label="Pending (queues)"
          value={queues.isError ? '—' : pendingTotal}
          hint="From telemetry samples"
          tone={pendingTotal ? 'warning' : 'neutral'}
        />
      </div>
      <Card>
        <FilterBar
          options={providerOptions}
          value={provider}
          onChange={setProvider}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search backends…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No backends"
            emptyBody="Catalogue empty for this filter."
            columns={[
              {
                key: 'backend_name',
                label: 'Backend',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_name')}
                    </Link>
                    <CopyableId value={String(row.backend_id || '')} />
                  </span>
                ),
              },
              {
                key: 'provider_id',
                label: 'Provider',
                render: (row) =>
                  row.provider_id ? (
                    <Link className="hover:underline" to={`/qrp/providers/${row.provider_id}`}>
                      {text(row, 'provider_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              { key: 'qubit_count', label: 'Qubits', sortable: true },
              { key: 'qpu_modality', label: 'Modality' },
              {
                key: 'pending',
                label: 'Pending',
                render: (row) => {
                  const q = queueById.get(String(row.backend_id || ''))
                  if (!q) return <span className="text-muted-foreground">—</span>
                  return <span className="tabular-nums">{String(q.pending_jobs ?? '—')}</span>
                },
              },
              {
                key: 'queue_condition',
                label: 'Queue',
                render: (row) => {
                  const q = queueById.get(String(row.backend_id || ''))
                  if (!q) return <span className="text-muted-foreground">—</span>
                  return (
                    <StatusBadge
                      tone={stateTone(String(q.queue_condition || '').toLowerCase())}
                      label={stateLabel(String(q.queue_condition || 'unknown'))}
                    />
                  )
                },
              },
              {
                key: 'operational_status',
                label: 'Catalogue status',
                render: (row) => (
                  <StatusBadge
                    tone={stateTone(String(row.operational_status || '').toLowerCase())}
                    label={stateLabel(String(row.operational_status || 'unknown'))}
                  />
                ),
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function BackendDetailPage() {
  const { backendId = '' } = useParams()
  const backend = useQuery({
    queryKey: ['backend', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}`),
    enabled: !!backendId,
  })
  const status = useQuery({
    queryKey: ['backend-status', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}/status`),
    enabled: !!backendId,
  })
  const queue = useQuery({
    queryKey: ['backend-queue', backendId],
    queryFn: () => qre<Row>(`/queues/${encodeURIComponent(backendId)}`),
    enabled: !!backendId,
    retry: false,
  })
  const topology = useQuery({
    queryKey: ['backend-topology', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}/topology`),
    enabled: !!backendId,
  })
  const alerts = useQuery({
    queryKey: ['alerts-summary-backend', backendId],
    queryFn: () => qre<Row>('/alerts/summary'),
    enabled: !!backendId,
    retry: false,
  })
  const nodes = Array.isArray(topology.data?.nodes) ? (topology.data.nodes as Row[]) : []
  const healthChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of nodes) {
      const key = String(row.health_status || 'unknown')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name: stateLabel(name),
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [nodes])
  const healthy = nodes.filter((row) => String(row.health_status || '').toLowerCase() === 'healthy').length
  const byBackend = (alerts.data?.by_backend as Record<string, number> | undefined) ?? {}
  const backendAlerts = byBackend[backendId] ?? byBackend[String(backend.data?.backend_id || '')] ?? null
  const pending =
    queue.isError
      ? status.data
        ? status.data.pending_jobs
        : '—'
      : queue.data?.pending_jobs
  return (
    <Page
      eyebrow="Operations"
      title={String(backend.data?.backend_name || backendId)}
      description="Catalogue record and topology from returned fields. Wait estimates come from Queues telemetry samples."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={backend.dataUpdatedAt || queue.dataUpdatedAt} />
          <CopyableId value={backendId} keep={14} />
          <Link to="/qrp/backends" className="btn-secondary">
            All backends
          </Link>
          <Link to="/qrp/queues" className="btn-ghost">
            Queues
          </Link>
          <Link to="/qrp/support" className="btn-ghost">
            Alerts
          </Link>
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Pending" value={pending} hint="Queue sample" tone={Number(pending) > 0 ? 'warning' : 'neutral'} />
        <MetricTile
          label="Wait (est.)"
          value={queue.data ? formatQueueWait(queue.data) : queue.isError ? 'Unavailable' : '—'}
          hint="Telemetry — missing ≠ zero"
        />
        <MetricTile
          label="Topology nodes"
          value={topology.isError ? '—' : (topology.data?.node_count ?? nodes.length)}
          hint={topology.data ? `${String(topology.data.edge_count ?? '—')} edges` : 'From topology'}
        />
        <MetricTile
          label="Active alerts"
          value={alerts.isError || backendAlerts == null ? '—' : backendAlerts}
          hint="From alerts summary by_backend"
          tone={Number(backendAlerts) > 0 ? 'warning' : 'neutral'}
        />
      </div>
      <QueryBody query={backend}>
        {backend.data && (
          <Card className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Catalogue status</span>
              <StatusBadge
                tone={stateTone(String(backend.data.operational_status || '').toLowerCase())}
                label={stateLabel(String(backend.data.operational_status || 'unknown'))}
              />
              {queue.data?.queue_condition != null && (
                <StatusBadge
                  tone={stateTone(String(queue.data.queue_condition || '').toLowerCase())}
                  label={`Queue ${stateLabel(String(queue.data.queue_condition))}`}
                />
              )}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Provider</dt>
                <dd className="mt-1">
                  {backend.data.provider_id ? (
                    <Link className="text-primary hover:underline" to={`/qrp/providers/${backend.data.provider_id}`}>
                      {text(backend.data, 'provider_id')}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Qubits / modality</dt>
                <dd className="mt-1">
                  {text(backend.data, 'qubit_count')} · {text(backend.data, 'qpu_modality')}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Topology type</dt>
                <dd className="mt-1">{text(backend.data, 'topology_type')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Queue trend</dt>
                <dd className="mt-1">{queue.data ? text(queue.data, 'trend') : '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Healthy qubits</dt>
                <dd className="mt-1 tabular-nums">
                  {topology.isError ? '—' : `${healthy}/${nodes.length || '—'}`}
                </dd>
              </div>
            </dl>
            <Notice tone="info">
              Catalogue status ≠ governance eligibility. Prefer Queues for wait provenance — `/backends/.../status` zeros missing wait.
            </Notice>
          </Card>
        )}
      </QueryBody>
      {healthChart.length > 0 && (
        <Card>
          <PanelHeader title="Qubit health mix" />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={healthChart} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2}>
                  {healthChart.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card>
        <h2 className="mb-3 text-base font-semibold">
          Qubits {topology.data ? `${String(topology.data.node_count)} nodes · ${String(topology.data.edge_count)} edges` : ''}
        </h2>
        <QueryBody query={topology}>
          <Table
            rows={nodes}
            emptyTitle="No topology nodes"
            emptyBody="Topology appears when the backend returns qubit health nodes."
            columns={[
              { key: 'qubit_index', label: 'Qubit' },
              {
                key: 'health_status',
                label: 'Health',
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.health_status || '').toLowerCase())} label={stateLabel(String(row.health_status || 'unknown'))} />
                ),
              },
              { key: 't1_us', label: 'T1 µs' },
              { key: 't2_us', label: 'T2 µs' },
              { key: 'readout_error', label: 'Readout error' },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

/** Exported for self-check — missing wait must never render as zero. */
export function formatQueueWait(row: Record<string, unknown>) {
  const wait = row.estimated_wait_time
  if (wait == null || wait === '') return 'Unavailable'
  const n = Number(wait)
  if (!Number.isFinite(n)) return 'Unavailable'
  if (n >= 3600) return `${(n / 3600).toFixed(1)} h (est.)`
  if (n >= 60) return `${Math.round(n / 60)} min (est.)`
  return `${Math.round(n)} s (est.)`
}

export function QueuesPage() {
  const [condition, setCondition] = useState('all')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['queues'],
    queryFn: () => qre<unknown>('/queues'),
  })
  const all = asList(query.data)
  const conditionOptions = useMemo(() => {
    const rows = asList(query.data)
    const ids = Array.from(new Set(rows.map((row) => String(row.queue_condition || '').toUpperCase()).filter(Boolean))).sort()
    return [{ id: 'all', label: 'All conditions' }, ...ids.map((id) => ({ id, label: id }))]
  }, [query.data])
  const rows = all.filter((row) => {
    if (condition !== 'all' && String(row.queue_condition || '').toUpperCase() !== condition) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['backend_name', 'backend_id', 'provider_id', 'queue_condition', 'trend', 'operational_status'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const missingWait = all.some((row) => row.estimated_wait_time == null || row.estimated_wait_time === '')
  const pendingTotal = all.reduce((sum, row) => sum + (Number(row.pending_jobs) || 0), 0)
  const withPending = all.filter((row) => Number(row.pending_jobs) > 0).length
  const moderateOrWorse = all.filter((row) => {
    const c = String(row.queue_condition || '').toUpperCase()
    return c && c !== 'OPTIMAL'
  }).length
  const waits = all
    .map((row) => Number(row.estimated_wait_time))
    .filter((n) => Number.isFinite(n))
  const maxWait = waits.length ? Math.max(...waits) : null
  const pendingChart = useMemo(() => {
    const source = asList(query.data)
    return source
      .map((row) => ({
        name: String(row.backend_name || row.backend_id || '?').replace(/\s*\(.*\)\s*$/, '').slice(0, 18),
        pending: Number(row.pending_jobs) || 0,
        wait: row.estimated_wait_time == null || row.estimated_wait_time === '' ? null : Number(row.estimated_wait_time),
      }))
      .sort((a, b) => b.pending - a.pending)
  }, [query.data])
  const conditionChart = useMemo(() => {
    const source = asList(query.data)
    const counts = new Map<string, number>()
    for (const row of source) {
      const key = String(row.queue_condition || 'UNKNOWN').toUpperCase()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [query.data])
  return (
    <Page
      eyebrow="Operations"
      title="Queues"
      description="Pending jobs and condition from the latest BackendTelemetry sample per backend — not a live provider SLA."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link className="btn-ghost" to="/qrp/centre">
            Ops centre
          </Link>
          <Link className="btn-ghost" to="/qrp/backends">
            Backends
          </Link>
        </span>
      }
    >
      <Notice tone="info">
        Wait times are estimated from stored telemetry samples (often simulated ingest). Prefer pending count and
        condition. Missing samples show as Unavailable, never zero.
      </Notice>
      {missingWait && !query.isPending && !query.isError && (
        <Notice tone="warning">One or more backends have no wait sample. Treat those rows as Unavailable.</Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Backends sampled" value={query.isError ? '—' : all.length} hint="Latest telemetry row each" />
        <MetricTile label="Pending jobs" value={query.isError ? '—' : pendingTotal} hint={`${withPending} backends with work`} tone={pendingTotal ? 'warning' : 'neutral'} />
        <MetricTile
          label="Non-optimal"
          value={query.isError ? '—' : moderateOrWorse}
          hint="Condition ≠ OPTIMAL"
          tone={moderateOrWorse ? 'warning' : 'success'}
        />
        <MetricTile
          label="Longest wait (est.)"
          value={query.isError || maxWait == null ? '—' : formatQueueWait({ estimated_wait_time: maxWait })}
          hint="Max among samples with wait"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <PanelHeader title="Pending by backend" />
          {query.isError ? (
            <EmptyState title="Queues unavailable" body={message(query.error)} />
          ) : query.isPending ? (
            <div className="h-48 animate-pulse rounded-lg bg-muted" />
          ) : pendingChart.length === 0 ? (
            <EmptyState title="No queue samples" body="Register backends and wait for telemetry ingest." />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pendingChart} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-16} textAnchor="end" height={52} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'wait') return [value == null ? 'Unavailable' : formatQueueWait({ estimated_wait_time: value }), 'Wait (est.)']
                      return [value, 'Pending']
                    }}
                  />
                  <Bar dataKey="pending" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <PanelHeader title="Condition mix" />
          {query.isPending ? (
            <div className="h-48 animate-pulse rounded-lg bg-muted" />
          ) : conditionChart.length === 0 ? (
            <EmptyState title="No conditions" body="Empty sample set." />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={conditionChart} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2}>
                    {conditionChart.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {conditionChart.map((d) => (
              <li key={d.name} className="flex justify-between gap-2">
                <span>{d.name}</span>
                <span className="tabular-nums font-medium text-foreground">{d.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <FilterBar
          options={conditionOptions}
          value={condition}
          onChange={setCondition}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Backend, provider, condition…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No queue samples"
            emptyBody={
              search || condition !== 'all'
                ? 'No rows match filters.'
                : 'Register backends and wait for telemetry ingest. Empty here means no samples, not zero wait.'
            }
            columns={[
              {
                key: 'backend_name',
                label: 'Backend',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_name')}
                    </Link>
                    <CopyableId value={String(row.backend_id || '')} />
                  </span>
                ),
              },
              {
                key: 'provider_id',
                label: 'Provider',
                render: (row) =>
                  row.provider_id ? (
                    <Link className="hover:underline" to={`/qrp/providers/${row.provider_id}`}>
                      {text(row, 'provider_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
              { key: 'qubit_count', label: 'Qubits', sortable: true },
              { key: 'pending_jobs', label: 'Pending', sortable: true },
              {
                key: 'estimated_wait_time',
                label: 'Wait (est.)',
                sortable: true,
                render: (row) => (
                  <span className={row.estimated_wait_time == null || row.estimated_wait_time === '' ? 'text-muted-foreground' : 'tabular-nums'}>
                    {formatQueueWait(row)}
                  </span>
                ),
              },
              {
                key: 'queue_condition',
                label: 'Condition',
                render: (row) => (
                  <StatusBadge
                    tone={stateTone(String(row.queue_condition || '').toLowerCase())}
                    label={stateLabel(String(row.queue_condition || 'unknown'))}
                  />
                ),
              },
              {
                key: 'trend',
                label: 'Trend',
                render: (row) => <StatusBadge tone="neutral" label={stateLabel(String(row.trend || 'unknown'))} />,
              },
              {
                key: 'operational_status',
                label: 'Catalogue',
                render: (row) => (
                  <StatusBadge
                    tone={stateTone(String(row.operational_status || '').toLowerCase())}
                    label={stateLabel(String(row.operational_status || 'unknown'))}
                  />
                ),
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function EvidencePage() {
  const client = useQueryClient()
  const [label, setLabel] = useState('')
  const query = useQuery({
    queryKey: ['evidence'],
    queryFn: () => qre<unknown>('/evidence/snapshots'),
  })
  const capture = useMutation({
    mutationFn: () =>
      qre('/evidence/snapshots', {
        method: 'POST',
        body: JSON.stringify({ label: label || undefined }),
      }),
    onSuccess: () => {
      setLabel('')
      void client.invalidateQueries({ queryKey: ['evidence'] })
    },
  })
  const download = useMutation({
    mutationFn: (snapshotId: string) =>
      qreDownload(`/evidence/snapshots/${encodeURIComponent(snapshotId)}/download`, `evidence-${snapshotId}.bin`),
  })
  const rows = asList(query.data)
  const fleetScoped = rows.filter((row) => !row.scope_backend_id).length
  const backendScoped = rows.filter((row) => Boolean(row.scope_backend_id)).length
  const latest = rows
    .map((row) => String(row.created_at || ''))
    .filter(Boolean)
    .sort()
    .at(-1)
  return (
    <Page
      eyebrow="Records"
      title="Evidence"
      description="Fleet/backend sealed snapshots on disk — not approval-package evidence unless a snapshot is bound to an approval."
      actions={
        <span className="flex flex-wrap gap-2">
          <DataFreshness updatedAt={query.dataUpdatedAt} />
          <Link className="btn-ghost" to="/qrp/audit">
            Audit trail
          </Link>
          <Link className="btn-ghost" to="/system/status">
            Platform status
          </Link>
        </span>
      }
    >
      <Notice tone="info">
        Capture packages the current fleet scope returned by the evidence API. This is TeleScope-style snapshot evidence, separate from governance audit export.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Snapshots" value={query.isError ? '—' : rows.length} hint="On disk" />
        <MetricTile label="Fleet scope" value={query.isError ? '—' : fleetScoped} hint="No backend id" />
        <MetricTile label="Backend scope" value={query.isError ? '—' : backendScoped} hint="Scoped captures" />
        <MetricTile label="Latest created" value={latest ? latest.slice(0, 19).replace('T', ' ') : '—'} hint="UTC sample" />
      </div>
      <Card>
        <PanelHeader title="Capture snapshot" />
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            capture.mutate()
          }}
        >
          <input className={fieldClass} value={label} placeholder="Label (optional)" onChange={(event) => setLabel(event.target.value)} />
          <button type="submit" className={buttonClass} disabled={capture.isPending}>
            {capture.isPending ? 'Capturing…' : 'Capture snapshot'}
          </button>
          {capture.error && <p className="w-full text-sm text-critical">{message(capture.error)}</p>}
        </form>
      </Card>
      <Card>
        {download.error && <Notice>{message(download.error)}</Notice>}
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No snapshots"
            emptyBody="Capture a snapshot for the supported fleet/backend scope."
            columns={[
              { key: 'label', label: 'Label' },
              {
                key: 'snapshot_id',
                label: 'Snapshot',
                render: (row) => <CopyableId value={String(row.snapshot_id || '')} />,
              },
              {
                key: 'scope_backend_id',
                label: 'Scope',
                render: (row) => (row.scope_backend_id ? text(row, 'scope_backend_id') : 'Fleet'),
              },
              {
                key: 'created_at',
                label: 'Created',
                render: (row) => <span className="font-mono text-[11px]">{text(row, 'created_at')}</span>,
              },
              { key: 'created_by', label: 'By' },
              {
                key: 'package_sha256',
                label: 'Package SHA-256',
                render: (row) => <span className="font-mono text-[10px] text-muted-foreground">{shortId(String(row.package_sha256 || ''), 16)}</span>,
              },
              {
                key: 'download',
                label: 'Download',
                render: (row) => (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    disabled={download.isPending || !row.snapshot_id}
                    onClick={() => download.mutate(String(row.snapshot_id))}
                  >
                    Download
                  </button>
                ),
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const session = getSessionUser()
  const [seedNote, setSeedNote] = useState<string | null>(null)
  const boundary = useQuery({
    queryKey: ['institution-boundary'],
    queryFn: () => qre<Row>('/governance/institution-boundary'),
    retry: false,
  })
  const release = useQuery({
    queryKey: ['release-evidence'],
    queryFn: () => qre<Row>('/governance/release-evidence'),
    retry: false,
  })
  const seedDemo = useMutation({
    mutationFn: seedPortalDemo,
    onSuccess: (result) => {
      setSeedNote(
        `Demo loaded: ${result.projects} projects · ${result.approvals} reviews · ${result.reservations} holds · ${result.pools} pools · ${result.assets} assets` +
          (result.errors.length ? ` (${result.errors.length} skipped)` : ''),
      )
      void client.invalidateQueries()
    },
    onError: (err) => setSeedNote(message(err)),
  })
  const fed = (boundary.data?.federation as Row | undefined) ?? {}
  const env = (release.data?.environment as Row | undefined) ?? {}
  const checks = (release.data?.automated_checks as Row | undefined) ?? {}
  const modules = Array.isArray(checks.pytest_modules) ? (checks.pytest_modules as string[]) : []
  return (
    <Page
      eyebrow="Workspace"
      title="Settings"
      description="Read-only institution boundary and release pointers. No secret values. Configuration editing is not enabled here."
      actions={
        <span className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={seedDemo.isPending}
            onClick={() => {
              setSeedNote(null)
              seedDemo.mutate()
            }}
          >
            {seedDemo.isPending ? 'Loading demo…' : 'Load demo workspace'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearSession()
              navigate('/login')
            }}
          >
            Sign out
          </button>
        </span>
      }
    >
      {seedNote && <Notice tone="info">{seedNote}</Notice>}
      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Demo workspace</h2>
        <p className="text-muted-foreground">
          Creates labeled demo projects, approval reviews, reservation holds, a pool, and inventory assets via real APIs so list pages look populated for walkthroughs.
        </p>
      </Card>
      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Session</h2>
        {session ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">User</dt>
              <dd className="mt-1 font-medium">{session.username}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Role</dt>
              <dd className="mt-1 font-medium">{session.role}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">No signed-in session in local storage.</p>
        )}
      </Card>
      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Institution boundary</h2>
        {boundary.data ? (
          <>
            <p>
              Tenant <CopyableId value={String(boundary.data.active_tenant_id || '')} keep={20} />
            </p>
            <p>
              Site {text(fed, 'local_site_name')} · peers {String(fed.peer_sites_reporting ?? '—')}/
              {String(fed.peer_sites_configured ?? '—')}
            </p>
            <p>{fed.read_only ? 'Federation reads are aggregate only.' : text(fed, 'disclaimer')}</p>
          </>
        ) : (
          <p className="text-muted-foreground">{boundary.isError ? message(boundary.error) : 'Loading boundary…'}</p>
        )}
      </Card>
      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Release evidence</h2>
        {release.data ? (
          <>
            <p>
              Product {text(release.data, 'product')} · RBAC {env.enforce_rbac ? 'enforced' : 'open'} · DB{' '}
              {env.database_url_is_sqlite_default ? 'sqlite default' : 'configured'}
            </p>
            <ul className="list-inside list-disc text-muted-foreground">
              {modules.slice(0, 5).map((mod) => (
                <li key={mod} className="font-mono text-xs">
                  {mod}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">{release.isError ? message(release.error) : 'Loading release pointers…'}</p>
        )}
      </Card>
      <Card className="space-y-2 text-sm">
        <p>
          <Link className="font-medium text-primary hover:underline" to="/system/status">
            Platform status
          </Link>
          {' · '}
          <Link className="font-medium text-primary hover:underline" to="/qrp/audit">
            Audit log
          </Link>
          {' · '}
          <Link className="font-medium text-primary hover:underline" to="/qrp/evidence">
            Evidence
          </Link>
        </p>
      </Card>
    </Page>
  )
}
