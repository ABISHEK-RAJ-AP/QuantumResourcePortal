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

import { asList, qre, qreDownload, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ReservationCalendar } from '@/components/data/ReservationCalendar'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
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
import { InfoTip } from '@/components/ui/InfoTip'
import { Modal } from '@/components/ui/Modal'
import { AccountSecurity } from '@/pages/workspace/AccountSecurity'
import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { StatusPage } from '@/pages/system/StatusPage'
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
      updatedAt={query.dataUpdatedAt}
    >
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
        </span>
      }
    >
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
  const approvedCount = approvalRows.filter((r) => String(r.governance_state || '') === 'approved').length
  const activeHolds = reservationRows.filter((r) => ['requested', 'active'].includes(String(r.state || ''))).length
  const locked = Boolean(project.data?.submission_lock)
  const archived = Boolean(project.data?.is_archived)
  const projectName = String(project.data?.name || projectId)
  const requestStateChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of approvalRows) {
      const key = stateLabel(String(row.governance_state || 'unknown'))
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [approvalRows])
  const readiness = [
    { ok: !archived, label: 'Project is active (not archived)' },
    { ok: memberRows.length > 0 || members.isError, label: members.isError ? 'Members API unavailable' : 'At least one member listed' },
    { ok: !locked, label: locked ? 'Submission unlocked (currently locked by open review)' : 'Submission unlocked' },
    { ok: !quota.isError, label: quota.isError ? 'Quota ledger reachable' : 'Quota ledger available' },
  ]

  return (
    <Page
      eyebrow="Workspace · Projects"
      title={projectName}
      description="Project hub: members, requests, holds, quota, and activity — create requests here with project already scoped."
      actions={
        <span className="flex flex-wrap gap-2">
          <CopyableId value={projectId} keep={14} />
          
          <button type="button" className="btn-primary" onClick={() => setTab('requests')}>
            {locked ? 'View requests' : 'Create resource request'}
          </button>
          <Link to="/qrp/scheduling" className="btn-secondary">
            Request hold
          </Link>
        </span>
      }
      updatedAt={project.dataUpdatedAt}
    >
      {project.isPending ? (
        <DetailSkeleton />
      ) : (
        <>
          <KpiStrip>
            <MetricTile label="Open reviews" value={approvals.isError ? '—' : openApprovals} hint="Needs reviewer action" tone={openApprovals ? 'warning' : 'neutral'} />
            <MetricTile label="Approved" value={approvals.isError ? '—' : approvedCount} hint="Eligible for hold / dispatch path" tone="success" />
            <MetricTile label="Requests" value={approvals.isError ? '—' : approvalRows.length} hint="All linked workloads" />
            <MetricTile label="Active holds" value={reservations.isError ? '—' : activeHolds} hint="Requested or active windows" />
            <MetricTile label="Members" value={members.isError ? '—' : memberRows.length} hint="Directory membership" /></KpiStrip>

          <RecordWorkspace
            tabs={PROJECT_TABS.map((t) => ({
              id: t.id,
              label: t.label,
              count:
                t.id === 'members'
                  ? memberRows.length
                  : t.id === 'requests'
                    ? approvalRows.length
                    : t.id === 'reservations'
                      ? reservationRows.length
                      : t.id === 'activity'
                        ? activityRows.length
                        : undefined,
            }))}
            activeTab={tab}
            onTabChange={(id) => setTab(id as ProjectTab)}
            nextAction={{
              title: locked
                ? 'Finish open review'
                : archived
                  ? 'Project archived'
                  : openApprovals
                    ? 'Open reviews waiting'
                    : 'Create or track requests',
              body: locked
                ? 'Submission locked until the open review finishes or is withdrawn.'
                : archived
                  ? 'Archived projects are read-only for new requests.'
                  : openApprovals
                    ? `${openApprovals} request(s) in review for this project.`
                    : 'Submit a scoped request, then track holds and usage from this hub.',
              blockers: [
                ...(archived ? ['Project is archived'] : []),
                ...(locked ? ['Submission lock active'] : []),
                ...(quota.data && quota.data.remaining_shots === 0 ? ['Daily shot remaining is 0'] : []),
              ],
              primary: locked || archived
                ? { label: 'Open Requests', onClick: () => setTab('requests') }
                : { label: 'Create request', onClick: () => setTab('requests') },
              secondary: { to: '/qrp/approvals', label: 'Review Queue' },
            }}
            related={[
              { to: '/qrp/approvals', label: 'Review Queue', hint: `${openApprovals} open here` },
              { to: '/qrp/reservations', label: 'All holds', hint: `${reservationRows.length} on project` },
              { to: '/qrp/scheduling', label: 'Schedule hold', hint: 'Guided window request' },
              { to: '/qrp/quotas', label: 'Quotas', hint: quota.isError ? 'Unavailable' : 'Institution ledger' },
              { to: '/qrp/metering', label: 'Metering', hint: 'Usage samples' },
              { to: '/qrp/inventory', label: 'Catalogue', hint: 'Eligible resources' },
              { to: '/qrp/reconciliation', label: 'Dispatch', hint: 'Attempts / reconcile' },
              { to: '/qrp/audit', label: 'Audit', hint: 'Decision trail' },
              { to: '/qrp/evidence', label: 'Evidence', hint: 'Snapshots' },
            ]}
          >
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

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="space-y-3">
                        <PanelHeader title="Project readiness" />
                        <ul className="space-y-2 text-sm">
                          {readiness.map((item) => (
                            <li key={item.label} className="flex items-start gap-2">
                              <span className={item.ok ? 'text-success' : 'text-critical'}>{item.ok ? '✓' : '!'}</span>
                              <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                            </li>
                          ))}
                        </ul>
                        <dl className="grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Owner</dt>
                            <dd className="mt-1 font-medium">{text(project.data, 'owner_username')}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Type</dt>
                            <dd className="mt-1">{String(project.data.project_type || '—').replace(/_/g, ' ')}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Description</dt>
                            <dd className="mt-1 text-muted-foreground">{text(project.data, 'description') || '—'}</dd>
                          </div>
                        </dl>
                      </Card>
                      <Card className="space-y-3">
                        <PanelHeader title="Request lifecycle mix" />
                        {requestStateChart.length === 0 ? (
                          <EmptyState title="No requests yet" body="Create a resource request to populate this chart." />
                        ) : (
                          <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={requestStateChart} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>
                                  {requestStateChart.map((d) => (
                                    <Cell key={d.name} fill={d.fill} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </Card>
                    </div>

                    <Card className="space-y-3">
                      <PanelHeader title="What needs attention" />
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('requests')}>
                          <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Open reviews</span>
                          <span className="text-lg font-semibold tabular-nums">{approvals.isError ? '—' : openApprovals}</span>
                        </button>
                        <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('reservations')}>
                          <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Active / requested holds</span>
                          <span className="text-lg font-semibold tabular-nums">{reservations.isError ? '—' : activeHolds}</span>
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
                  </div>
                )}
              </QueryBody>
            )}

            {tab === 'members' && (
              <Card className="space-y-3">
                <PanelHeader title="Members" />
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
                  {locked ? (
                    <EmptyState title="Submission locked" body="This project is locked while a review is in progress." />
                  ) : archived ? (
                    <EmptyState title="Archived" body="Unarchive before submitting new requests." />
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
          </RecordWorkspace>
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
              <KpiStrip>
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
                <MetricTile label="Age" value={formatAlertAge(row.detected_at)} hint={String(row.detected_at || '')} /></KpiStrip>

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
  const [createOpen, setCreateOpen] = useState(false)
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
      setCreateOpen(false)
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
      crumbs={[{ label: 'Catalogue', to: '/qrp/inventory' }, { label: 'Pools' }]}
      title="Resource pools"
      actions={
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          New pool
        </button>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <Modal open={createOpen} title="New pool" onClose={() => setCreateOpen(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <input
            required
            className={fieldClass}
            value={name}
            placeholder="Pool name"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {create.error ? <p className="text-sm text-critical">{message(create.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonClass} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
      <KpiStrip>
        <MetricTile label="Pools" value={query.isError ? '—' : all.length} />
        <MetricTile label="Members" value={query.isError ? '—' : memberTotal} />
        <MetricTile label="Empty" value={query.isError ? '—' : emptyPools} tone={emptyPools ? 'warning' : 'neutral'} />
        <MetricTile label="Assets" value={inventory.isError ? '—' : (inventory.data?.length ?? 0)} />
      </KpiStrip>
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
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="Connectors" value={query.isError ? '—' : all.length} hint="Mirrors providers" />
        <MetricTile label="Collector OK" value={query.isError ? '—' : collectorOk} hint="Last status" tone="success" />
        <MetricTile label="Backends detected" value={query.isError ? '—' : backendsDetected} hint="Sum of last runs" />
        <MetricTile label="Circuit open" value={query.isError ? '—' : circuitOpen} hint="Breaker state" tone={circuitOpen ? 'critical' : 'neutral'} /></KpiStrip>
      <QueryBody query={query}>
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartPanel title="Stage mix" empty={stageChart.length === 0}>
            {(h) =>
              stageChart.length === 0 ? (
                <EmptyState title="No connectors" body="Empty catalogue." />
              ) : (
                <ResponsiveContainer width="100%" height={h}>
                  <PieChart>
                    <Pie data={stageChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                      {stageChart.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
          </ChartPanel>
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
  const [view, setView] = useState<'overview' | 'attempts' | 'contract'>('overview')
  const [attemptFilter, setAttemptFilter] = useState('all')
  const [search, setSearch] = useState('')
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
  const failed = attemptRows.filter((row) => row.dispatch_state === 'dispatch_failed').length
  const jobRows = asList(jobs.data)
  const stateChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of attemptRows) {
      const key = stateLabel(String(row.dispatch_state || 'unknown'))
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [attemptRows])
  const filteredAttempts = attemptRows.filter((row) => {
    if (attemptFilter === 'needs' && !needsReconcile(row)) return false
    if (attemptFilter !== 'all' && attemptFilter !== 'needs' && String(row.dispatch_state || '') !== attemptFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['attempt_id', 'workload_id', 'backend_id', 'dispatch_state', 'external_job_id'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  return (
    <Page
      eyebrow="Operations"
      title="Dispatch & Jobs"
      description="Bridge governance approval to provider execution: durable attempts, ICD contract, and links to jobs / reconcile. Approval ≠ provider submission."
      actions={
        <span className="flex flex-wrap gap-2">
          <Link to="/qrp/reconciliation" className="btn-primary">
            Open reconciliation
          </Link>
          <Link to="/qrp/jobs" className="btn-secondary">
            Provider jobs
          </Link>
        </span>
      }
      updatedAt={attempts.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="ICD version" value={query.isError ? '—' : text(query.data ?? {}, 'icd_version')} hint="Contract" />
        <MetricTile
          label="Live connector"
          value={query.isError ? '—' : query.data?.live_connector ? 'Claimed' : 'Off'}
          hint="I5 claim flag"
          tone={query.data?.live_connector ? 'success' : 'neutral'}
        />
        <MetricTile label="Needs reconcile" value={attempts.isError ? '—' : unresolved} hint="Authorized / unresolved" tone={unresolved ? 'critical' : 'neutral'} />
        <MetricTile label="Confirmed" value={attempts.isError ? '—' : confirmed} hint="External outcome" tone="success" />
        <MetricTile label="Provider jobs" value={jobs.isError ? '—' : jobRows.length} hint="Sample /jobs?limit=50" /></KpiStrip>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Dispatch views">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'attempts', label: `Attempts (${attemptRows.length})` },
            { id: 'contract', label: 'ICD contract' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={view === t.id}
            className={view === t.id ? 'btn-secondary' : 'btn-ghost'}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <ChartPanel title="Attempt state mix" empty={stateChart.length === 0}>
              {(h) =>
                stateChart.length === 0 ? (
                  <EmptyState title="No attempts yet" body="Attempts appear after approve → authorize → record attempt." />
                ) : (
                  <ResponsiveContainer width="100%" height={h}>
                    <PieChart>
                      <Pie data={stateChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                        {stateChart.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )
              }
            </ChartPanel>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricTile label="Unresolved path" value={unresolved} hint="Needs operator" tone={unresolved ? 'critical' : 'neutral'} />
              <MetricTile label="Failed" value={failed} hint="Recorded failures" tone="warning" />
              <MetricTile label="Running jobs" value={jobRows.filter((r) => String(r.status || '').toUpperCase() === 'RUNNING').length} hint="Provider-reported" />
            </div>
          </div>
          <Card>
            <PanelHeader
              title="Operator path"
              action={
                <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/reconciliation">
                  Reconcile
                </Link>
              }
            />
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>Approve workload on Review Queue (governance only).</li>
              <li>Confirm reservation / eligibility, then authorise dispatch.</li>
              <li>Record durable attempt before connector call.</li>
              <li>Reconcile outcome — never blind retry ambiguous calls.</li>
              <li>Cross-check provider job when external_job_id exists.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => setView('attempts')}>
                Browse attempts
              </button>
            </div>
          </Card>
        </div>
      )}

      {view === 'attempts' && (
        <Card>
          <FilterBar
            options={[
              { id: 'all', label: 'All' },
              { id: 'needs', label: 'Needs reconcile' },
              { id: 'dispatch_confirmed', label: 'Confirmed' },
              { id: 'dispatch_failed', label: 'Failed' },
              { id: 'dispatch_unresolved', label: 'Unresolved' },
              { id: 'dispatch_authorized', label: 'Authorized' },
            ]}
            value={attemptFilter}
            onChange={setAttemptFilter}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search attempts…"
            defaultId="all"
          />
          <QueryBody query={attempts}>
            <Table
              rows={filteredAttempts}
              emptyTitle="No attempts"
              emptyBody="Dispatch attempts appear after authorisation and record-attempt."
              columns={[
                {
                  key: 'attempt_id',
                  label: 'Attempt',
                  render: (row) => <CopyableId value={String(row.attempt_id || '')} keep={10} />,
                },
                {
                  key: 'workload_id',
                  label: 'Request',
                  render: (row) =>
                    row.workload_id ? (
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                        {shortId(String(row.workload_id), 12)}
                      </Link>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'dispatch_state',
                  label: 'Governance / attempt',
                  render: (row) => (
                    <StatusBadge tone={stateTone(String(row.dispatch_state || ''))} label={stateLabel(String(row.dispatch_state || '—'))} />
                  ),
                },
                {
                  key: 'external_job_id',
                  label: 'Provider job',
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
                  key: 'go',
                  label: 'Next',
                  render: (row) =>
                    needsReconcile(row) ? (
                      <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/reconciliation">
                        Reconcile
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    ),
                },
              ]}
            />
          </QueryBody>
        </Card>
      )}

      {view === 'contract' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <QueryBody query={query}>
            <Card className="space-y-3 text-sm">
              <PanelHeader title="ICD endpoints" />
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Reconcile outcomes</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {outcomes.length ? outcomes.map((o) => <StatusBadge key={o} tone="neutral" label={o} />) : '—'}
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
          <Card className="space-y-3">
            <PanelHeader title="Safeguards" />
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
              <li>Distinguish governance request from provider job.</li>
              <li>Ambiguous timeout → unresolved, not auto-retry.</li>
              <li>Confirmed requires provider-reported external_job_id when policy says so.</li>
              <li>Connector capability gaps block submission — see Connectors.</li>
            </ul>
            <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/connectors">
              Connector maturity →
            </Link>
          </Card>
        </div>
      )}
    </Page>
  )
}

type CatalogRole = { id: string; label: string; builtin?: boolean; permissions?: number; permission_ids?: string[] }

export function UsersPage() {
  const client = useQueryClient()
  const session = getSessionUser()
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
            <button type="button" className="btn-secondary" onClick={() => setRoleOpen(true)} title="Create a catalog role from a clone">
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
            if (!window.confirm(`Assign ${role} to ${username}?`)) return
            save.mutate()
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
      <Card>
        <PanelHeader
          title="Role catalog"
          action={
            <InfoTip label="Role catalog">
              SuperAdmin, PlatformAdmin, and Admin share full platform permissions. Custom roles persist in data/custom_roles.json.
            </InfoTip>
          }
        />
        <QueryBody query={catalog}>
          <Table
            rows={roles as unknown as Row[]}
            emptyTitle="No roles"
            emptyBody="Catalog unavailable."
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
                        if (!window.confirm(`Delete role ${String(row.id)}?`)) return
                        deleteRole.mutate(String(row.id))
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
  const investigating = all.filter((row) => ['investigating', 'acknowledged'].includes(String(row.status || '').toLowerCase())).length
  const criticalCount = all.filter((row) => String(row.severity || '').toLowerCase() === 'critical').length
  const alertTotal = all.reduce((sum, row) => sum + (Number(row.alert_count) || 0), 0)
  const severityChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.severity || 'unset')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [all])
  const statusChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = stateLabel(String(row.status || 'open').toLowerCase())
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
  }, [all])
  return (
    <Page
      eyebrow="Operations"
      title="Incidents"
      description="Operational exception cases with lifecycle, ownership, and alert groups. Prefer incidents over scrolling raw qubit alerts."
      actions={
        <span className="flex flex-wrap gap-2">
          <Link to="/qrp/support" className="btn-secondary">
            Active alerts
          </Link>
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="Listed" value={query.isError ? '—' : all.length} hint="Latest sync sample" />
        <MetricTile label="Open" value={query.isError ? '—' : openCount} hint="Needs triage" tone={openCount ? 'critical' : 'neutral'} />
        <MetricTile label="In progress" value={query.isError ? '—' : investigating} hint="Ack / investigating" tone="warning" />
        <MetricTile label="Critical severity" value={query.isError ? '—' : criticalCount} hint="Among listed" tone={criticalCount ? 'critical' : 'neutral'} />
        <MetricTile
          label="Linked alerts"
          value={query.isError ? '—' : alertTotal || alertSummary.data?.active}
          hint={alertSummary.isError ? 'From incident rows' : `${String(alertSummary.data?.active ?? '—')} active fleet-wide`}
          tone="warning"
        /></KpiStrip>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="By severity" empty={severityChart.length === 0}>
          {(h) =>
            severityChart.length === 0 ? (
              <EmptyState title="No incidents" body="Cases appear when triage opens an incident." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <PieChart>
                  <Pie data={severityChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                    {severityChart.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
        <ChartPanel title="By status" empty={statusChart.length === 0}>
          {(h) =>
            statusChart.length === 0 ? (
              <EmptyState title="No status mix" body="Empty until incidents exist." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={statusChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
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
              {
                key: 'owner',
                label: 'Owner',
                render: (row) => <span className="text-sm">{text(row, 'owner') || '—'}</span>,
              },
              { key: 'alert_count', label: 'Alerts', sortable: true },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

const INCIDENT_FLOW: WorkflowStep[] = [
  { id: 'OPEN', label: 'Detected' },
  { id: 'ACKNOWLEDGED', label: 'Triaged' },
  { id: 'INVESTIGATING', label: 'Investigating' },
  { id: 'RESOLVED', label: 'Resolved' },
]

function incidentStepIndex(status: string) {
  const s = status.toUpperCase()
  if (s === 'RESOLVED' || s === 'CLOSED') return 3
  if (s === 'INVESTIGATING' || s === 'MITIGATING') return 2
  if (s === 'ACKNOWLEDGED' || s === 'ASSIGNED') return 1
  return 0
}

export function IncidentDetailPage() {
  const { incidentId = '' } = useParams()
  const client = useQueryClient()
  const [note, setNote] = useState('')
  const [tab, setTab] = useState('overview')
  const query = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => qre<Row>(`/incidents/${encodeURIComponent(incidentId)}`),
    enabled: !!incidentId,
  })
  const attempts = useQuery({
    queryKey: ['incident-dispatch', incidentId],
    queryFn: async () => asList(await qre<unknown>('/dispatch-attempts')),
    retry: false,
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
  const backendId = query.data?.backend_id ? String(query.data.backend_id) : ''
  const relatedAttempts = (attempts.data ?? []).filter((row) =>
    backendId ? String(row.backend_id || '') === backendId : false,
  )
  const resolved = status.toUpperCase() === 'RESOLVED' || status.toUpperCase() === 'CLOSED'
  const nextTitle = resolved
    ? 'Incident closed'
    : status.toUpperCase() === 'INVESTIGATING'
      ? 'Mitigate and resolve'
      : status.toUpperCase() === 'ACKNOWLEDGED'
        ? 'Start investigation'
        : 'Acknowledge / triage'
  const nextBody = resolved
    ? 'Review evidence and audit. Reopen only if policy allows.'
    : 'Capture notes, link affected jobs/attempts, then advance status. Acknowledge ≠ resolve.'

  return (
    <Page
      eyebrow="Operations · Incidents"
      title={String(query.data?.title || incidentId)}
      description={String(query.data?.summary || 'Operational exception lifecycle — links alerts, backends, and dispatch context.')}
      steps={INCIDENT_FLOW}
      stepIndex={incidentStepIndex(status)}
      actions={
        <span className="flex flex-wrap gap-2">
          <CopyableId value={incidentId} keep={14} />
          
          <Link to="/qrp/incidents" className="btn-secondary">
            All incidents
          </Link>
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <QueryBody query={query}>
        {query.data && (
          <RecordWorkspace
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'investigate', label: 'Investigate' },
              { id: 'alerts', label: 'Alerts', count: alerts.length },
              { id: 'related', label: 'Related', count: relatedAttempts.length },
              { id: 'records', label: 'Records' },
            ]}
            activeTab={tab}
            onTabChange={setTab}
            nextAction={{
              title: nextTitle,
              body: nextBody,
              blockers: undefined,
              primary: resolved
                ? { to: '/qrp/evidence', label: 'Evidence' }
                : status.toUpperCase() === 'INVESTIGATING'
                  ? { label: 'Resolve', onClick: () => act.mutate('resolve'), disabled: act.isPending }
                  : status.toUpperCase() === 'ACKNOWLEDGED'
                    ? { label: 'Investigate', onClick: () => act.mutate('investigate'), disabled: act.isPending }
                    : { label: 'Acknowledge', onClick: () => act.mutate('acknowledge'), disabled: act.isPending },
              secondary: { to: '/qrp/incidents', label: 'Queue' },
            }}
            related={[
              ...(backendId
                ? [{ to: `/qrp/backends/${backendId}`, label: 'Backend', hint: backendId.slice(0, 18) }]
                : []),
              { to: '/qrp/support', label: 'Alerts', hint: `${alerts.length} linked` },
              { to: '/qrp/reconciliation', label: 'Reconciliation', hint: `${relatedAttempts.length} same backend` },
              { to: '/qrp/jobs', label: 'Provider jobs', hint: 'Execution catalogue' },
              { to: '/qrp/evidence', label: 'Evidence', hint: 'Capture / retrieve' },
              { to: '/qrp/audit', label: 'Audit', hint: 'Consequential actions' },
              { to: '/qrp/centre', label: 'Ops centre', hint: 'Action cockpit' },
            ]}
          >
            {tab === 'overview' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="space-y-3">
                  <PanelHeader title="Incident summary" />
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={stateTone(status.toLowerCase())} label={stateLabel(status)} />
                    <StatusBadge
                      tone={String(query.data.severity || '').toLowerCase() === 'critical' ? 'critical' : 'warning'}
                      label={String(query.data.severity || '—')}
                    />
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Owner</dt>
                      <dd className="mt-1 font-medium">{text(query.data, 'owner') || 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Backend</dt>
                      <dd className="mt-1">
                        {backendId ? (
                          <Link className="text-primary hover:underline" to={`/qrp/backends/${backendId}`}>
                            {backendId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Alert count</dt>
                      <dd className="mt-1 tabular-nums font-semibold">{String(query.data.alert_count ?? alerts.length)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Updated</dt>
                      <dd className="mt-1 text-xs text-muted-foreground">{text(query.data, 'updated_at')}</dd>
                    </div>
                  </dl>
                  <p className="text-sm text-muted-foreground">{text(query.data, 'summary')}</p>
                </Card>
                <Card className="space-y-3">
                  <PanelHeader title="Lifecycle" />
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li>1. Detect / group alerts → open incident</li>
                    <li>2. Acknowledge (triage) with optional note</li>
                    <li>3. Investigate linked jobs / dispatch / backends</li>
                    <li>4. Resolve with reason — distinct from alert ack</li>
                  </ol>
                  </Card>
              </div>
            )}

            {tab === 'investigate' && (
              <Card className="space-y-4">
                <PanelHeader title="Investigation actions" />
                <label className="block text-sm">
                  Note / resolution reason
                  <input className={fieldClass} value={note} placeholder="Required for resolve when notes expected" onChange={(event) => setNote(event.target.value)} />
                </label>
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
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={act.isPending}
                      onClick={() => {
                        if (!note.trim() && !window.confirm('Resolve without notes?')) return
                        act.mutate('resolve')
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
                {act.error && <p className="text-sm text-critical">{message(act.error)}</p>}
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  <li>Checklist: confirm affected backend, open related attempts, capture evidence if required.</li>
                  <li>Do not mark resolved solely by acknowledging an alert group.</li>
                </ul>
              </Card>
            )}

            {tab === 'alerts' && (
              <Card>
                <PanelHeader title="Linked alerts" />
                <Table
                  rows={alerts}
                  emptyTitle="No alerts linked"
                  emptyBody="Alerts appear when triage attaches detector rows to this case."
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
            )}

            {tab === 'related' && (
              <Card className="space-y-3">
                <PanelHeader title="Dispatch attempts on same backend" />
                <Table
                  rows={relatedAttempts}
                  emptyTitle="No matching attempts"
                  emptyBody="Attempts with this backend appear after authorize → record attempt."
                  columns={[
                    {
                      key: 'attempt_id',
                      label: 'Attempt',
                      render: (row) => <CopyableId value={String(row.attempt_id || '')} keep={10} />,
                    },
                    {
                      key: 'workload_id',
                      label: 'Request',
                      render: (row) =>
                        row.workload_id ? (
                          <Link className="text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                            {shortId(String(row.workload_id), 12)}
                          </Link>
                        ) : (
                          '—'
                        ),
                    },
                    {
                      key: 'dispatch_state',
                      label: 'State',
                      render: (row) => (
                        <StatusBadge tone={stateTone(String(row.dispatch_state || ''))} label={stateLabel(String(row.dispatch_state || '—'))} />
                      ),
                    },
                  ]}
                />
                <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/reconciliation">
                  Open reconciliation →
                </Link>
              </Card>
            )}

            {tab === 'records' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="space-y-2">
                  <PanelHeader title="Evidence" />
                  <p className="text-sm text-muted-foreground">Capture operational snapshots that support this incident claim.</p>
                  <Link className="btn-secondary" to="/qrp/evidence">
                    Open evidence
                  </Link>
                </Card>
                <Card className="space-y-2">
                  <PanelHeader title="Audit" />
                  <p className="text-sm text-muted-foreground">Acknowledge / investigate / resolve append to the audit trail.</p>
                  <Link className="btn-secondary" to="/qrp/audit">
                    Open audit
                  </Link>
                </Card>
              </div>
            )}
          </RecordWorkspace>
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
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="Listed" value={query.isError ? '—' : all.length} hint="Sample limit 50" />
        <MetricTile label="Queued" value={query.isError ? '—' : queued} hint="Provider-reported" />
        <MetricTile label="Running" value={query.isError ? '—' : running} hint="Provider-reported" tone="primary" />
        <MetricTile label="Completed" value={query.isError ? '—' : completed} hint="Provider-reported" tone="success" />
        <MetricTile label="Failed" value={query.isError ? '—' : failed} hint="Provider-reported" tone="warning" /></KpiStrip>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel title="Status mix" empty={statusChart.length === 0}>
          {(h) =>
            statusChart.length === 0 ? (
              <EmptyState title="No jobs" body="Empty provider sample." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <PieChart>
                  <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                    {statusChart.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
        <ChartPanel className="xl:col-span-2" title="Jobs by backend" empty={backendChart.length === 0}>
          {(h) =>
            backendChart.length === 0 ? (
              <EmptyState title="No backends" body="Empty sample." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={backendChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(_, p) => String((p?.[0]?.payload as { full?: string } | undefined)?.full || '')} />
                  <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
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
          <Link className="btn-primary" to="/qrp/approvals">
            Approvals
          </Link>
          <Link className="btn-secondary" to="/qrp/reconciliation">
            Reconciliation
          </Link>
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
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
        /></KpiStrip>
      <QueryBody query={query}>
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartPanel title="Fleet reachability" empty={fleetChart.length === 0}>
            {(h) =>
              fleetChart.length === 0 ? (
                <EmptyState title="No fleet sample" body="Centre returned empty fleet counts." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(120, h - 28)}>
                    <PieChart>
                      <Pie data={fleetChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, (h - 28) * 0.28)} outerRadius={Math.max(48, (h - 28) * 0.42)} paddingAngle={2}>
                        {fleetChart.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="mt-1 text-center text-sm tabular-nums">
                    {String(fleet.online ?? '—')}/{String(fleet.total ?? '—')} online
                    {fleet.simulated_catalog != null ? ` · ${String(fleet.simulated_catalog)} simulated` : ''}
                  </p>
                </>
              )
            }
          </ChartPanel>
          <ChartPanel
            className="xl:col-span-2"
            title="Queue pending by backend"
            empty={queues.isError || pendingChart.length === 0}
            action={
              <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/queues">
                Queues
              </Link>
            }
          >
            {(h) =>
              queues.isError ? (
                <EmptyState title="Queues unavailable" body={message(queues.error)} />
              ) : pendingChart.length === 0 ? (
                <EmptyState title="No queue samples" body="Telemetry not ingested yet." />
              ) : (
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={pendingChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={48} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </ChartPanel>
        </div>

        <KpiStrip>
          <MetricTile label="Backends" value={fleet.total} hint="Registered in catalogue" />
          <MetricTile label="Online" value={fleet.online} hint="Currently reachable" tone="success" />
          <MetricTile label="Assets (gov)" value={summary.data?.inventory_assets} hint="From governance summary" />
          <MetricTile label="Providers active" value={summary.data?.providers_active} hint="Catalogue active" /></KpiStrip>

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
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="Catalogue" value={query.isError ? '—' : all.length} hint={`${providers.length} providers`} />
        <MetricTile label="Online" value={query.isError ? '—' : online} hint="Catalogue ONLINE" tone="success" />
        <MetricTile label="Qubits (sum)" value={query.isError ? '—' : qubitTotal} hint="Catalogue qubit_count" />
        <MetricTile
          label="Pending (queues)"
          value={queues.isError ? '—' : pendingTotal}
          hint="From telemetry samples"
          tone={pendingTotal ? 'warning' : 'neutral'}
        /></KpiStrip>
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
          <CopyableId value={backendId} keep={14} />
          <Link to="/qrp/backends" className="btn-secondary">
            All backends
          </Link>
        </span>
      }
      updatedAt={backend.dataUpdatedAt || queue.dataUpdatedAt}
    >
      <KpiStrip>
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
        /></KpiStrip>
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
            </Card>
        )}
      </QueryBody>
      {healthChart.length > 0 ? (
        <ChartPanel title="Qubit health mix" empty={false}>
          {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <PieChart>
                <Pie data={healthChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                  {healthChart.map((d) => (
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
      description="Pending jobs and queue condition from latest telemetry per backend."
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
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
      </KpiStrip>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel
          className="xl:col-span-2"
          title="Pending by backend"
          empty={query.isError || query.isPending || pendingChart.length === 0}
        >
          {(h) =>
            query.isError ? (
              <EmptyState title="Queues unavailable" body={message(query.error)} />
            ) : query.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : pendingChart.length === 0 ? (
              <EmptyState title="No queue samples" body="Register backends and wait for telemetry ingest." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
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
            )
          }
        </ChartPanel>
        <ChartPanel title="Condition mix" empty={query.isPending || conditionChart.length === 0}>
          {(h) =>
            query.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : conditionChart.length === 0 ? (
              <EmptyState title="No conditions" body="Empty sample set." />
            ) : (
              <div className="flex h-full flex-col gap-2">
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={conditionChart} dataKey="value" nameKey="name" innerRadius={Math.max(32, h * 0.2)} outerRadius={Math.max(52, h * 0.32)} paddingAngle={2}>
                        {conditionChart.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="shrink-0 space-y-1 text-xs text-muted-foreground">
                  {conditionChart.map((d) => (
                    <li key={d.name} className="flex justify-between gap-2">
                      <span>{d.name}</span>
                      <span className="tabular-nums font-medium text-foreground">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        </ChartPanel>
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
                : 'Register backends and wait for telemetry ingest. No telemetry samples for this filter.'
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
  const [captureOpen, setCaptureOpen] = useState(false)
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
      setCaptureOpen(false)
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
      crumbs={[{ label: 'Records', to: '/qrp/audit' }, { label: 'Evidence' }]}
      title="Evidence"
      actions={
        <button type="button" className="btn-primary" onClick={() => setCaptureOpen(true)}>
          Capture snapshot
        </button>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <Modal open={captureOpen} title="Capture snapshot" onClose={() => setCaptureOpen(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            capture.mutate()
          }}
        >
          <input
            className={fieldClass}
            value={label}
            placeholder="Label (optional)"
            onChange={(event) => setLabel(event.target.value)}
            autoFocus
          />
          {capture.error ? <p className="text-sm text-critical">{message(capture.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCaptureOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonClass} disabled={capture.isPending}>
              {capture.isPending ? 'Capturing…' : 'Capture'}
            </button>
          </div>
        </form>
      </Modal>
      <KpiStrip>
        <MetricTile label="Snapshots" value={query.isError ? '—' : rows.length} />
        <MetricTile label="Fleet scope" value={query.isError ? '—' : fleetScoped} />
        <MetricTile label="Backend scope" value={query.isError ? '—' : backendScoped} />
        <MetricTile label="Latest" value={latest ? latest.slice(0, 19).replace('T', ' ') : '—'} />
      </KpiStrip>
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
  const session = getSessionUser()
  const boundary = useQuery({
    queryKey: ['institution-boundary'],
    queryFn: () => qre<Row>('/governance/institution-boundary'),
    retry: false,
  })
  const fed = (boundary.data?.federation as Row | undefined) ?? {}
  return (
    <Page
      crumbs={[{ label: 'Admin' }, { label: 'Settings' }]}
      title="Settings"
      actions={
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
      }
    >
      <Card className="space-y-2 text-sm">
        <PanelHeader title="Session" />
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
          <p className="text-muted-foreground">No session.</p>
        )}
      </Card>
      <AccountSecurity />
      <Card className="space-y-2 text-sm">
        <PanelHeader title="Institution" />
        {boundary.data ? (
          <>
            <p>
              Tenant <CopyableId value={String(boundary.data.active_tenant_id || '')} keep={20} />
            </p>
            <p>
              Site {text(fed, 'local_site_name')} · peers {String(fed.peer_sites_reporting ?? '—')}/
              {String(fed.peer_sites_configured ?? '—')}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{boundary.isError ? message(boundary.error) : 'Loading…'}</p>
        )}
      </Card>
      <Card className="space-y-3">
        <PanelHeader title="Health" />
        <StatusPage framed />
      </Card>
      <Card className="space-y-2 text-sm">
        <PanelHeader title="Records" />
        <p className="flex flex-wrap gap-3">
          <Link className="font-medium text-primary hover:underline" to="/qrp/users">
            Users & Roles
          </Link>
          <Link className="font-medium text-primary hover:underline" to="/qrp/audit">
            Audit
          </Link>
          <Link className="font-medium text-primary hover:underline" to="/qrp/evidence">
            Evidence
          </Link>
        </p>
      </Card>
    </Page>
  )
}
