import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
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
import { ReservationCalendar } from '@/components/data/ReservationCalendar'
import { getSessionUser } from '@/lib/session'
import { cn } from '@/lib/utils'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { StatusBadge } from '@/components/status/StatusBadge'
import { InfoTip } from '@/components/ui/InfoTip'
import { Modal } from '@/components/ui/Modal'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import {
  Card,
  EmptyState,
  LoadingLine,
  MetricTile,
  Notice,
  Page,
  PanelHeader,
  stateLabel,
  stateTone,
} from '@/components/layout/Page'
import type { WorkflowStep } from '@/components/workflow/WorkflowSteps'

/** Role → which pipeline stage to emphasize (counts still come from APIs). */
function overviewFocus(role: string) {
  const r = (role || '').toLowerCase()
  if (r.includes('auditor') || r.includes('security')) return { kind: 'auditor' as const, primaryTo: '/qrp/audit' }
  if (r.includes('incident')) return { kind: 'incident' as const, primaryTo: '/qrp/incidents' }
  if (r.includes('ops') || r.includes('operator') || r.includes('quantumops')) {
    return { kind: 'ops' as const, primaryTo: '/qrp/centre' }
  }
  if (r.includes('research') || r.includes('viewer') || r.includes('analyst')) {
    return { kind: 'researcher' as const, primaryTo: '/qrp/projects' }
  }
  return { kind: 'reviewer' as const, primaryTo: '/qrp/approvals' }
}

type Row = Record<string, unknown>

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed'
}

function useRows(key: string, path: string) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => asList(await qre<unknown>(path)),
  })
}

export function shortId(value: string, keep = 8) {
  if (!value) return '—'
  return value.length > keep + 1 ? `${value.slice(0, keep)}…` : value
}

type TableColumn = {
  key: string
  label: string
  render?: (row: Row) => ReactNode
  /** Client-side sort by raw field value when true. */
  sortable?: boolean
}

function compareRows(a: Row, b: Row, key: string) {
  const av = a[key]
  const bv = b[key]
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

export function Table({
  columns,
  rows,
  emptyTitle = 'Nothing here yet',
  emptyBody = 'Records appear when the linked service returns data for this tenant.',
}: {
  columns: TableColumn[]
  rows: Row[]
  emptyTitle?: string
  emptyBody?: ReactNode
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />
  }
  const sorted =
    sortKey == null
      ? rows
      : [...rows].sort((a, b) => {
          const cmp = compareRows(a, b, sortKey)
          return sortDir === 'asc' ? cmp : -cmp
        })
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2.5 font-semibold first:ps-0 last:pe-0">
                {col.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => {
                      if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                      else {
                        setSortKey(col.key)
                        setSortDir('asc')
                      }
                    }}
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={String(row.workload_id || row.asset_id || row.id || index)} className="border-b border-border/70 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2.5 align-middle first:ps-0 last:pe-0">
                  {col.render ? col.render(row) : text(row, col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function QueryBody({
  query,
  children,
}: {
  query: { isPending: boolean; error: unknown; data?: unknown }
  children: ReactNode
}) {
  if (query.isPending) return <LoadingLine />
  if (query.error) return <Notice>{message(query.error)}</Notice>
  return children
}

const APPROVAL_PATH: WorkflowStep[] = [
  { id: 'submit', label: 'Submit' },
  { id: 'review', label: 'Review' },
  { id: 'authorise', label: 'Authorise' },
]

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function OverviewPage() {
  const user = getSessionUser()
  const focus = overviewFocus(user?.role || 'Operator')
  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
  })
  const centre = useQuery({
    queryKey: ['operations-centre'],
    queryFn: () => qre<Row>('/operations/centre'),
    retry: false,
  })
  const ledger = useQuery({
    queryKey: ['quota-ledger-home'],
    queryFn: () => qre<Row>('/quotas/ledger'),
    retry: false,
  })
  const attempts = useQuery({
    queryKey: ['dispatch-attempts-home'],
    queryFn: () => qre<unknown>('/dispatch-attempts'),
    retry: false,
  })
  const alertSummary = useQuery({
    queryKey: ['alerts-summary-home'],
    queryFn: () => qre<Row>('/alerts/summary'),
    retry: false,
  })
  const recent = useRows('approvals-recent', '/approvals')
  const myApprovals = useQuery({
    queryKey: ['approvals-mine-home'],
    queryFn: async () => asList(await qre<unknown>('/approvals?scope=mine')),
    retry: false,
  })
  const activity = useQuery({
    queryKey: ['governance-activity-home'],
    queryFn: () => qre<unknown>('/governance/activity?limit=8'),
    retry: false,
  })
  const counts = (summary.data?.counts as Row | undefined) ?? {}
  const fleet = (centre.data?.fleet as Row | undefined) ?? {}
  const ops = (centre.data?.operations as Row | undefined) ?? {}
  const attemptRows = asList(attempts.data)
  const unresolvedRows = attemptRows.filter((row) => {
    const state = String(row.dispatch_state || '')
    return state === 'dispatch_unresolved' || state === 'dispatch_authorized'
  })
  const unresolvedAttempts = unresolvedRows.length
  const activityRows = asList(activity.data)
  const myRows = myApprovals.data ?? []
  const openIncidents = Number(ops.open_incidents || 0)
  const queueCount = Number(summary.data?.queue ?? 0)
  const used = Number(ledger.data?.used_shots ?? 0)
  const remaining = Number(ledger.data?.remaining_shots ?? 0)
  const cap = Number(ledger.data?.daily_shots_cap ?? 0)

  const lifecycleChart = useMemo(
    () =>
      [
        { name: 'Queue', value: Number(summary.data?.queue ?? 0) },
        { name: 'In review', value: Number(counts.in_review ?? 0) },
        { name: 'Approved', value: Number(counts.approved ?? 0) },
        { name: 'Rejected', value: Number(counts.rejected ?? 0) },
        { name: 'Withdrawn', value: Number(counts.withdrawn ?? 0) },
      ].filter((d) => d.value > 0 || d.name === 'Queue'),
    [summary.data?.queue, counts],
  )

  const quotaChart = useMemo(() => {
    if (ledger.isError || (!used && !remaining && !cap)) return []
    return [
      { name: 'Used', value: used, fill: 'var(--chart-5)' },
      { name: 'Remaining', value: remaining || Math.max(cap - used, 0), fill: 'var(--chart-4)' },
    ]
  }, [ledger.isError, used, remaining, cap])

  const alertBackendChart = useMemo(() => {
    const by = (alertSummary.data?.by_backend as Record<string, number> | undefined) ?? {}
    return Object.entries(by)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' ').slice(0, 18), value, full: name }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [alertSummary.data])

  const fleetOnline = Number(fleet.online ?? 0)
  const fleetTotal = Number(fleet.total ?? 0)
  const fleetOffline = Math.max(fleetTotal - fleetOnline, 0)

  const pipeline = [
    { label: 'Review', to: '/qrp/approvals', value: summary.isError ? '—' : queueCount, hot: queueCount > 0 },
    { label: 'Hold', to: '/qrp/scheduling', value: '→', hot: false },
    { label: 'Dispatch', to: '/qrp/jobs', value: attempts.isError ? '—' : unresolvedAttempts, hot: unresolvedAttempts > 0 },
    { label: 'Incidents', to: '/qrp/incidents', value: centre.isError ? '—' : openIncidents, hot: openIncidents > 0 },
    { label: 'Audit', to: '/qrp/audit', value: '→', hot: false },
  ]

  return (
    <Page
      crumbs={[{ label: 'Command', to: '/qrp' }, { label: 'Overview' }]}
      title="Overview"
      description={`${user?.role || 'Operator'} · ${user?.username || '—'}`}
      updatedAt={summary.dataUpdatedAt || ledger.dataUpdatedAt || centre.dataUpdatedAt}
    >
      <Card>
        <PanelHeader title="Pipeline" />
        <div className="grid gap-2 sm:grid-cols-5">
          {pipeline.map((step) => (
            <Link
              key={step.label}
              to={step.to}
              className={cn(
                'rounded-lg border px-3 py-2.5 hover:bg-accent',
                step.hot ? 'border-warning/40 bg-warning-soft/30' : 'border-border',
                focus.primaryTo === step.to ? 'ring-1 ring-primary/40' : '',
              )}
            >
              <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{step.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{step.value}</span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Link className="rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-accent" to="/qrp/approvals">
          <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Needs review</span>
          <span className="text-2xl font-semibold tabular-nums">{summary.isError ? '—' : queueCount}</span>
        </Link>
        <Link className="rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-accent" to="/qrp/approvals?filter=mine">
          <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">My requests</span>
          <span className="text-2xl font-semibold tabular-nums">{myApprovals.isError ? '—' : myRows.length}</span>
        </Link>
        <Link className="rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-accent" to="/qrp/reconciliation">
          <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Unresolved dispatch</span>
          <span className="text-2xl font-semibold tabular-nums">{attempts.isError ? '—' : unresolvedAttempts}</span>
        </Link>
        <Link className="rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-accent" to="/qrp/incidents">
          <span className="block text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Open incidents</span>
          <span className="text-2xl font-semibold tabular-nums">{centre.isError ? '—' : openIncidents}</span>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel
          title="Request stages"
          action={
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/approvals">
              Queue
            </Link>
          }
          empty={summary.isError || summary.isPending || lifecycleChart.every((d) => d.value === 0)}
        >
          {(h) =>
            summary.isError ? (
              <EmptyState title="Summary unavailable" body={message(summary.error)} />
            ) : summary.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : lifecycleChart.every((d) => d.value === 0) ? (
              <EmptyState title="No request volume" body="Submit from a project." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={lifecycleChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {lifecycleChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>

        <ChartPanel
          title="Daily shot quota"
          action={
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/quotas">
              Ledger
            </Link>
          }
          empty={ledger.isError || ledger.isPending || quotaChart.length === 0}
        >
          {(h) =>
            ledger.isError ? (
              <EmptyState title="Quota unavailable" body={message(ledger.error)} />
            ) : ledger.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : quotaChart.length === 0 ? (
              <EmptyState title="No quota sample" body="Ledger empty." />
            ) : (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={quotaChart} dataKey="value" nameKey="name" innerRadius={Math.max(36, h * 0.22)} outerRadius={Math.max(56, h * 0.34)} paddingAngle={2}>
                        {quotaChart.map((d, i) => (
                          <Cell key={d.name} fill={d.fill || CHART_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="shrink-0 text-center text-sm tabular-nums">
                  <span className="font-semibold">{used}</span> used · <span className="font-semibold">{remaining || cap - used}</span> left
                  {cap ? ` / ${cap}` : ''} · UTC today
                </p>
              </div>
            )
          }
        </ChartPanel>

        <ChartPanel
          title="Alerts by backend"
          action={
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/support">
              Alerts
            </Link>
          }
          empty={alertSummary.isError || alertSummary.isPending || alertBackendChart.length === 0}
        >
          {(h) =>
            alertSummary.isError ? (
              <EmptyState title="Alert rollup unavailable" body={message(alertSummary.error)} />
            ) : alertSummary.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : alertBackendChart.length === 0 ? (
              <EmptyState title="No active alerts" body="Fleet quiet." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={alertBackendChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [v, 'Active alerts']} labelFormatter={(_, p) => String((p?.[0]?.payload as { full?: string } | undefined)?.full || '')} />
                  <Bar dataKey="value" fill="var(--chart-5)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
      </div>

      <KpiStrip>
        <MetricTile label="Fleet online" value={centre.isError ? '—' : `${fleetOnline}/${fleetTotal || '—'}`} hint={fleetOffline ? `${fleetOffline} offline` : 'Reachable'} tone="success" />
        <MetricTile label="Assets" value={summary.isError ? '—' : summary.data?.inventory_assets} />
        <MetricTile label="Active alerts" value={alertSummary.isError ? ops.active_alerts : alertSummary.data?.active} tone="warning" />
        <MetricTile label="Open incidents" value={centre.isError ? '—' : openIncidents} tone={openIncidents ? 'critical' : 'neutral'} />
      </KpiStrip>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <PanelHeader title="Queue" action={<Link className="text-xs font-medium text-primary hover:underline" to="/qrp/approvals">All</Link>} />
          <QueryBody query={recent}>
            <Table
              rows={(recent.data ?? []).slice(0, 6)}
              emptyTitle="Queue empty"
              emptyBody="Nothing waiting on policy stages."
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
                    <StatusBadge tone={stateTone(String(row.governance_state || ''))} label={stateLabel(String(row.governance_state || 'unknown'))} />
                  ),
                },
                { key: 'created_by', label: 'Requester' },
              ]}
            />
          </QueryBody>
        </Card>
        <Card>
          <PanelHeader title="Dispatch exceptions" action={<Link className="text-xs font-medium text-primary hover:underline" to="/qrp/reconciliation">All</Link>} />
          {attempts.isError ? (
            <Notice tone="warning">Dispatch attempts unavailable.</Notice>
          ) : unresolvedRows.length === 0 ? (
            <EmptyState title="Clear" body="No unresolved dispatch attempts." />
          ) : (
            <Table
              rows={unresolvedRows.slice(0, 6)}
              columns={[
                {
                  key: 'attempt_id',
                  label: 'Attempt',
                  render: (row) => (
                    <Link className="font-medium text-primary hover:underline" to="/qrp/reconciliation">
                      {shortId(String(row.attempt_id || ''), 12)}
                    </Link>
                  ),
                },
                {
                  key: 'dispatch_state',
                  label: 'State',
                  render: (row) => (
                    <StatusBadge tone={stateTone(String(row.dispatch_state || ''))} label={stateLabel(String(row.dispatch_state || 'open'))} />
                  ),
                },
                {
                  key: 'workload_id',
                  label: 'Request',
                  render: (row) =>
                    row.workload_id ? (
                      <Link className="hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                        {shortId(String(row.workload_id), 10)}
                      </Link>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
          )}
        </Card>
        <Card className="lg:col-span-2">
          <PanelHeader title="Recent decisions" action={<Link className="text-xs font-medium text-primary hover:underline" to="/qrp/audit">Audit</Link>} />
          {activity.isError ? (
            <Notice tone="warning">Activity feed unavailable.</Notice>
          ) : (
            <Table
              rows={activityRows.slice(0, 8)}
              emptyTitle="No decisions yet"
              emptyBody="Approve and reject events land here."
              columns={[
                {
                  key: 'timestamp',
                  label: 'When',
                  render: (row) => {
                    const t = new Date(String(row.timestamp || '')).getTime()
                    if (!Number.isFinite(t)) return '—'
                    const h = Math.round((Date.now() - t) / 3_600_000)
                    return h < 48 ? `${h}h ago` : new Date(t).toLocaleDateString()
                  },
                },
                { key: 'actor', label: 'Actor' },
                { key: 'action', label: 'Action' },
                {
                  key: 'target_id',
                  label: 'Request',
                  render: (row) =>
                    row.target_id ? (
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.target_id}`}>
                        {shortId(String(row.target_id), 10)}
                      </Link>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </Page>
  )
}

/** Server query presets — maps to GET /approvals?state=&scope= */
const APPROVAL_FILTERS = [
  { id: 'queue', label: 'Needs review' },
  { id: 'mine', label: 'My requests' },
  { id: 'submitted_for_review', label: 'Submitted' },
  { id: 'in_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
] as const

function approvalsPath(filter: string) {
  if (filter === 'queue') return '/approvals'
  if (filter === 'mine') return '/approvals?scope=mine'
  return `/approvals?state=${encodeURIComponent(filter)}`
}

export function ApprovalsPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterParam = searchParams.get('filter')
  const initialFilter = APPROVAL_FILTERS.some((f) => f.id === filterParam)
    ? (filterParam as (typeof APPROVAL_FILTERS)[number]['id'])
    : 'queue'
  const [filter, setFilter] = useState<(typeof APPROVAL_FILTERS)[number]['id']>(initialFilter)
  const [search, setSearch] = useState('')
  const setApprovalFilter = (id: (typeof APPROVAL_FILTERS)[number]['id']) => {
    setFilter(id)
    if (id === 'queue') setSearchParams({}, { replace: true })
    else setSearchParams({ filter: id }, { replace: true })
  }
  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
  })
  const query = useQuery({
    queryKey: ['approvals', filter],
    queryFn: async () => asList(await qre<unknown>(approvalsPath(filter))),
  })
  const seed = useMutation({
    mutationFn: async () => {
      const listed = asList(await qre<unknown>('/projects'))
      let projectId = listed[0]?.project_id ? String(listed[0].project_id) : ''
      if (!projectId) {
        const createdProject = await qre<Row>('/projects', {
          method: 'POST',
          body: JSON.stringify({ name: `Demo ${new Date().toISOString().slice(0, 16)}`, project_type: 'quantum_circuit' }),
        })
        projectId = String(createdProject.project_id)
      }
      const draft = await qre<Row>('/workload-submissions', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId }),
      })
      return qre<Row>(`/workload-submissions/${encodeURIComponent(String(draft.submission_id))}/submit-for-review`, {
        method: 'POST',
      })
    },
    onSuccess: (row) => {
      void client.invalidateQueries({ queryKey: ['approvals'] })
      void client.invalidateQueries({ queryKey: ['governance-summary'] })
      if (row.workload_id) navigate(`/qrp/approvals/${row.workload_id}`)
    },
  })
  const counts = (summary.data?.counts as Row | undefined) ?? {}
  const rows = (query.data ?? []).filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['workload_id', 'project_id', 'created_by', 'governance_state'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const stageChart = useMemo(
    () =>
      [
        { name: 'Queue', value: Number(summary.data?.queue ?? 0), fill: 'var(--chart-1)' },
        { name: 'In review', value: Number(counts.in_review ?? 0), fill: 'var(--chart-2)' },
        { name: 'Approved', value: Number(counts.approved ?? 0), fill: 'var(--chart-4)' },
        { name: 'Rejected', value: Number(counts.rejected ?? 0), fill: 'var(--chart-5)' },
        { name: 'Withdrawn', value: Number(counts.withdrawn ?? 0), fill: 'var(--chart-3)' },
      ].filter((d) => d.value > 0 || d.name === 'Queue'),
    [summary.data?.queue, counts],
  )
  const nextRow = rows[0]
  return (
    <Page
      crumbs={[{ label: 'Review', to: '/qrp/approvals' }, { label: 'Queue' }]}
      title="Review Queue"
      actions={
        nextRow?.workload_id ? (
          <Link className="btn-primary" to={`/qrp/approvals/${nextRow.workload_id}`}>
            Open {shortId(String(nextRow.workload_id), 8)}
          </Link>
        ) : (
          <button type="button" className="btn-secondary" disabled={seed.isPending} onClick={() => seed.mutate()}>
            {seed.isPending ? 'Submitting…' : 'Seed review'}
          </button>
        )
      }
      updatedAt={query.dataUpdatedAt || summary.dataUpdatedAt}
    >
      <KpiStrip className="xl:grid-cols-5">
        <button type="button" className="text-start" onClick={() => setApprovalFilter('queue')}>
          <MetricTile label="Needs review" value={summary.data?.queue} tone="primary" />
        </button>
        <button type="button" className="text-start" onClick={() => setApprovalFilter('in_review')}>
          <MetricTile label="In review" value={counts.in_review} tone="warning" />
        </button>
        <button type="button" className="text-start" onClick={() => setApprovalFilter('approved')}>
          <MetricTile label="Approved" value={counts.approved} tone="success" />
        </button>
        <button type="button" className="text-start" onClick={() => setApprovalFilter('rejected')}>
          <MetricTile label="Rejected" value={counts.rejected} tone="critical" />
        </button>
        <button type="button" className="text-start" onClick={() => setApprovalFilter('mine')}>
          <MetricTile label="Mine" value={filter === 'mine' ? rows.length : '→'} />
        </button>
      </KpiStrip>
      <ChartPanel title="Stages" empty={summary.isError || stageChart.every((d) => d.value === 0)}>
        {(h) =>
          summary.isError ? (
            <EmptyState title="Summary unavailable" body={message(summary.error)} />
          ) : stageChart.every((d) => d.value === 0) ? (
            <EmptyState title="No request volume" body="Submit from a project." />
          ) : (
            <ResponsiveContainer width="100%" height={h}>
              <BarChart data={stageChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stageChart.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </ChartPanel>
      {seed.error && <Notice>{message(seed.error)}</Notice>}
      <Card>
        <FilterBar
          options={APPROVAL_FILTERS}
          value={filter}
          onChange={(id) => setApprovalFilter(id as (typeof APPROVAL_FILTERS)[number]['id'])}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search workload, project, requester…"
          defaultId="queue"
        />
        <QueryBody query={query}>
          {rows.length === 0 ? (
            <EmptyState
              title="No approvals"
              body={search.trim() ? 'No rows match search.' : 'Submit a workload for review, or seed one from a project.'}
              action={
                search.trim() ? (
                  <button type="button" className="btn-secondary" onClick={() => setSearch('')}>
                    Clear search
                  </button>
                ) : (
                  <button type="button" className="btn-primary" disabled={seed.isPending} onClick={() => seed.mutate()}>
                    {seed.isPending ? 'Submitting…' : 'Start demo review'}
                  </button>
                )
              }
            />
          ) : (
            <Table
              rows={rows}
              columns={[
                {
                  key: 'workload_id',
                  label: 'Request',
                  render: (row) => (
                    <span className="flex flex-col gap-0.5">
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                        {shortId(String(row.workload_id || ''), 14)}
                      </Link>
                      <CopyableId value={String(row.workload_id || '')} />
                    </span>
                  ),
                },
                {
                  key: 'governance_state',
                  label: 'Stage / state',
                  sortable: true,
                  render: (row) => (
                    <StatusBadge tone={stateTone(String(row.governance_state || ''))} label={stateLabel(String(row.governance_state || 'unknown'))} />
                  ),
                },
                { key: 'created_by', label: 'Requester', sortable: true },
                {
                  key: 'project_id',
                  label: 'Project',
                  sortable: true,
                  render: (row) =>
                    row.project_id ? (
                      <Link className="hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        {shortId(String(row.project_id), 10)}
                      </Link>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'created_at',
                  label: 'Submitted',
                  sortable: true,
                  render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{text(row, 'created_at')}</span>,
                },
                {
                  key: 'open',
                  label: 'Action',
                  render: (row) => (
                    <Link className="text-sm font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                      Open review
                    </Link>
                  ),
                },
              ]}
            />
          )}
        </QueryBody>
      </Card>
    </Page>
  )
}

function progressSteps(row: Row): { steps: WorkflowStep[]; index: number } {
  const progress = (row.governance_progress as Row | undefined) ?? {}
  const stages = Array.isArray(progress.stages) ? (progress.stages as Row[]) : []
  const steps: WorkflowStep[] =
    stages.length > 0
      ? stages.map((stage, i) => ({
          id: String(stage.id || i),
          label: String(stage.label || `Stage ${i + 1}`),
        }))
      : APPROVAL_PATH
  const index = Number(progress.stage_index ?? 0)
  const state = String(row.governance_state || '')
  if (state === 'approved') return { steps, index: steps.length }
  return { steps, index: Number.isFinite(index) ? index : 0 }
}

export function ApprovalDetailPage() {
  const { workloadId = '' } = useParams()
  const client = useQueryClient()
  const [comment, setComment] = useState('')
  const [tab, setTab] = useState('overview')
  const query = useQuery({
    queryKey: ['approval', workloadId],
    queryFn: () => qre<Row>(`/approvals/${encodeURIComponent(workloadId)}`),
    enabled: !!workloadId,
  })
  const quota = useQuery({
    queryKey: ['quota-eval', workloadId],
    queryFn: () => qre<Row>(`/quotas/evaluate?workload_id=${encodeURIComponent(workloadId)}`),
    enabled: !!workloadId,
    retry: false,
  })
  const decide = useMutation({
    mutationFn: (decision: string) => {
      const progress = (query.data?.governance_progress as Row | undefined) ?? {}
      const stage = (progress.current_stage as Row | undefined) ?? {}
      return qre(`/approvals/${encodeURIComponent(workloadId)}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          comment: comment || decision,
          expected_stage_id: stage.id,
        }),
      })
    },
    onSuccess: () => {
      setComment('')
      void client.invalidateQueries({ queryKey: ['approval', workloadId] })
      void client.invalidateQueries({ queryKey: ['approvals'] })
      void client.invalidateQueries({ queryKey: ['governance-summary'] })
    },
  })
  const confirmDecide = (decision: string) => {
    if (decide.isPending) return
    const ok = window.confirm(`Record decision “${decision}” for ${workloadId}?`)
    if (ok) decide.mutate(decision)
  }
  const withdraw = useMutation({
    mutationFn: () =>
      qre(`/approvals/${encodeURIComponent(workloadId)}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || 'withdraw' }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['approval', workloadId] }),
  })
  const confirmWithdraw = () => {
    if (withdraw.isPending) return
    if (window.confirm(`Withdraw ${workloadId}?`)) withdraw.mutate()
  }
  const row = query.data
  const trail = row ? progressSteps(row) : { steps: APPROVAL_PATH, index: 0 }
  const progress = (row?.governance_progress as Row | undefined) ?? {}
  const stage = (progress.current_stage as Row | undefined) ?? {}
  const history = Array.isArray(row?.history) ? (row.history as Row[]) : []
  const closed = ['approved', 'rejected', 'withdrawn'].includes(String(row?.governance_state || ''))
  const projectId = row?.project_id ? String(row.project_id) : ''
  const relatedReservations = useQuery({
    queryKey: ['approval-reservations', projectId],
    queryFn: async () => asList(await qre<unknown>(`/reservations?project_id=${encodeURIComponent(projectId)}`)),
    enabled: !!projectId,
    retry: false,
  })
  const relatedAttempts = useQuery({
    queryKey: ['approval-dispatch', workloadId],
    queryFn: async () =>
      asList(await qre<unknown>('/dispatch-attempts')).filter((r) => String(r.workload_id || '') === workloadId),
    enabled: !!workloadId,
    retry: false,
  })
  const govState = String(row?.governance_state || '')
  const nextHint =
    govState === 'submitted_for_review' || govState === 'in_review'
      ? `Decide · ${text(stage, 'label')}`
      : govState === 'approved'
        ? 'Approved. Request hold next.'
        : govState === 'rejected' || govState === 'withdrawn'
          ? 'Closed.'
          : text(stage, 'label')

  return (
    <Page
      crumbs={[
        { label: 'Review', to: '/qrp/approvals' },
        { label: 'Queue', to: '/qrp/approvals' },
        { label: shortId(workloadId, 10) },
      ]}
      title={row ? stateLabel(String(row.governance_state || 'review')) : 'Request'}
      steps={trail.steps}
      stepIndex={trail.index}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <CopyableId value={workloadId} keep={16} />
          <InfoTip label="Approval scope">
            Decision writes to audit and advances stages. Does not dispatch a provider job. After approved: Schedule hold → authorize dispatch.
          </InfoTip>
          <Link to="/qrp/approvals" className="btn-secondary">
            Queue
          </Link>
          {govState === 'approved' ? (
            <Link to="/qrp/scheduling" className="btn-primary">
              Request hold
            </Link>
          ) : null}
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <QueryBody query={query}>
        {row && (
          <>
            <RecordWorkspace
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'governance', label: 'Governance' },
                { id: 'decide', label: 'Decide' },
                { id: 'activity', label: 'Activity', count: history.length },
                { id: 'ops', label: 'Operations', count: relatedAttempts.data?.length ?? 0 },
              ]}
              activeTab={tab}
              onTabChange={setTab}
              nextAction={{
                title: closed ? 'Closed' : `Decide · ${text(stage, 'label')}`,
                body: nextHint,
                blockers: quota.data && !quota.data.allowed ? ['Over daily shot cap'] : undefined,
                primary: closed
                  ? govState === 'approved'
                    ? { to: '/qrp/scheduling', label: 'Request hold' }
                    : { to: '/qrp/approvals', label: 'Queue' }
                  : tab === 'decide'
                    ? undefined
                    : { label: 'Decide', onClick: () => setTab('decide') },
                secondary: { to: '/qrp/approvals', label: 'Queue' },
              }}
              related={[
                ...(projectId ? [{ to: `/qrp/projects/${projectId}`, label: 'Project', hint: shortId(projectId, 14) }] : []),
                { to: '/qrp/quotas', label: 'Quotas', hint: quota.data ? (quota.data.allowed ? 'Within cap' : 'Over cap') : '—' },
                {
                  to: '/qrp/reservations',
                  label: 'Holds',
                  hint: relatedReservations.isError ? '—' : `${relatedReservations.data?.length ?? 0}`,
                },
                {
                  to: '/qrp/reconciliation',
                  label: 'Dispatch',
                  hint: relatedAttempts.isError ? '—' : `${relatedAttempts.data?.length ?? 0}`,
                },
                { to: '/qrp/audit', label: 'Audit' },
              ]}
            >
              {tab === 'overview' && (
                <Card>
                  <PanelHeader title="Request" />
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Requester</dt>
                      <dd className="mt-1 font-medium">{text(row, 'created_by')}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">State</dt>
                      <dd className="mt-1">
                        <StatusBadge
                          tone={stateTone(String(row.governance_state || ''))}
                          label={stateLabel(String(row.governance_state || 'unknown'))}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Stage</dt>
                      <dd className="mt-1 font-medium">
                        {text(stage, 'label')} ({String(Number(progress.stage_index ?? 0) + 1)}/
                        {String(progress.stage_total ?? trail.steps.length)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Submitted</dt>
                      <dd className="mt-1 text-xs text-muted-foreground">{text(row, 'created_at')}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Project</dt>
                      <dd className="mt-1">
                        {row.project_id ? (
                          <Link className="font-mono text-xs text-primary hover:underline break-all" to={`/qrp/projects/${row.project_id}`}>
                            {text(row, 'project_id')}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Package SHA-256</dt>
                      <dd className="mt-1 font-mono text-xs break-all text-muted-foreground">{text(row, 'package_sha256')}</dd>
                    </div>
                  </dl>
                </Card>
              )}

              {tab === 'governance' && (
                <div className="grid gap-5 lg:grid-cols-2">
                  <Card>
                    <PanelHeader title="Policy" />
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Policy</dt>
                        <dd className="mt-1">
                          {text(progress, 'policy_id')} · v{text(progress, 'policy_version')}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Current stage</dt>
                        <dd className="mt-1 font-medium">{text(stage, 'label')}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Required permission</dt>
                        <dd className="mt-1 font-mono text-xs">{text(stage, 'required_permission')}</dd>
                      </div>
                    </dl>
                    <Link className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" to="/qrp/policies">
                      Open full policy →
                    </Link>
                  </Card>
                  <Card>
                    <PanelHeader
                      title="Quota evaluation"
                      action={
                        <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/quotas">
                          Ledger
                        </Link>
                      }
                    />
                    {quota.data ? (
                      <div className="space-y-3">
                        <StatusBadge
                          tone={quota.data.allowed ? 'success' : 'critical'}
                          label={quota.data.allowed ? 'Within daily shot cap' : 'Over daily shot cap'}
                        />
                        <dl className="grid gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Requested</dt>
                            <dd className="mt-1 font-semibold tabular-nums">{String(quota.data.requested_shots ?? '—')}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Remaining</dt>
                            <dd className="mt-1 font-semibold tabular-nums">{String(quota.data.remaining_shots ?? '—')}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Reason</dt>
                            <dd className="mt-1 font-mono text-xs">{text(quota.data, 'reason_code')}</dd>
                          </div>
                        </dl>
                        <p className="text-xs text-muted-foreground">Daily simulation-shot window · UTC · missing ≠ zero elsewhere.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{quota.isError ? message(quota.error) : 'Checking the shot cap…'}</p>
                    )}
                  </Card>
                </div>
              )}

              {tab === 'decide' && (
                <Card className="space-y-4">
                  <PanelHeader title="Decision" />
                  <p className="text-sm text-muted-foreground">
                    Record approve / changes / reject for the current stage. Withdraw returns the package to the requester.
                  </p>
                  {!closed && (
                    <>
                      <textarea
                        className="field-input min-h-[88px]"
                        rows={3}
                        placeholder="Decision rationale (stored on the audit trail)"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => confirmDecide('approve')}
                          className="rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => confirmDecide('changes_requested')}
                          className="rounded-xl bg-warning px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Request changes
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => confirmDecide('reject')}
                          className="rounded-xl bg-critical px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button type="button" disabled={withdraw.isPending} onClick={confirmWithdraw} className="btn-secondary">
                          Withdraw
                        </button>
                      </div>
                    </>
                  )}
                  {closed && (
                    <p className="text-sm text-muted-foreground">This workload is closed ({stateLabel(String(row.governance_state))}).</p>
                  )}
                  {decide.error && <p className="text-sm text-critical">{message(decide.error)}</p>}
                  {withdraw.error && <p className="text-sm text-critical">{message(withdraw.error)}</p>}
                </Card>
              )}

              {tab === 'activity' && (
                <Card>
                  <PanelHeader title="Stage / decision history" />
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground">No decisions yet. First review creates the trail.</p>
                  )}
                  <ul className="divide-y divide-border/70">
                    {history.map((record) => (
                      <li key={String(record.record_id)} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            tone={stateTone(String(record.decision || ''))}
                            label={stateLabel(String(record.decision || 'note'))}
                          />
                          <span className="text-xs text-muted-foreground">
                            {text(record, 'actor_username')} · {text(record, 'stage_id')}
                          </span>
                        </div>
                        <p className="text-sm">{text(record, 'comment')}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {tab === 'ops' && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <PanelHeader
                      title="Dispatch attempts"
                      action={
                        <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/reconciliation">
                          Reconcile
                        </Link>
                      }
                    />
                    <Table
                      rows={relatedAttempts.data ?? []}
                      emptyTitle="No attempts for this request"
                      emptyBody="Attempts appear after authorize → record attempt. Approved ≠ dispatched."
                      columns={[
                        {
                          key: 'attempt_id',
                          label: 'Attempt',
                          render: (r) => <CopyableId value={String(r.attempt_id || '')} keep={10} />,
                        },
                        {
                          key: 'dispatch_state',
                          label: 'State',
                          render: (r) => (
                            <StatusBadge
                              tone={stateTone(String(r.dispatch_state || ''))}
                              label={stateLabel(String(r.dispatch_state || 'open'))}
                            />
                          ),
                        },
                      ]}
                    />
                  </Card>
                  <Card>
                    <PanelHeader
                      title="Project holds"
                      action={
                        <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/reservations">
                          All holds
                        </Link>
                      }
                    />
                    <Table
                      rows={(relatedReservations.data ?? []).slice(0, 8)}
                      emptyTitle="No holds on project"
                      emptyBody="Schedule hold after approval if capacity window needed."
                      columns={[
                        {
                          key: 'reservation_id',
                          label: 'Hold',
                          render: (r) => <CopyableId value={String(r.reservation_id || '')} keep={10} />,
                        },
                        {
                          key: 'state',
                          label: 'State',
                          render: (r) => (
                            <StatusBadge tone={stateTone(String(r.state || ''))} label={stateLabel(String(r.state || 'requested'))} />
                          ),
                        },
                        { key: 'resource_ref', label: 'Resource' },
                      ]}
                    />
                  </Card>
                </div>
              )}
            </RecordWorkspace>
          </>
        )}
      </QueryBody>
    </Page>
  )
}

const INVENTORY_EXEC = [
  { id: 'all', label: 'All classes' },
  { id: 'simulated', label: 'Simulated' },
  { id: 'hardware', label: 'Hardware' },
] as const

const INVENTORY_LIFE = [
  { id: 'all', label: 'All lifecycle' },
  { id: 'registered', label: 'Registered' },
  { id: 'active', label: 'Active' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'retired', label: 'Retired' },
] as const

export function InventoryPage() {
  const [exec, setExec] = useState<(typeof INVENTORY_EXEC)[number]['id']>('all')
  const [life, setLife] = useState<(typeof INVENTORY_LIFE)[number]['id']>('all')
  const [search, setSearch] = useState('')
  const params = new URLSearchParams()
  if (exec !== 'all') params.set('execution_class', exec)
  if (life !== 'all') params.set('lifecycle_state', life)
  const qs = params.toString()
  const allQuery = useQuery({
    queryKey: ['assets-all'],
    queryFn: async () => asList(await qre<unknown>('/inventory/assets')),
  })
  const query = useQuery({
    queryKey: ['assets', exec, life],
    queryFn: async () => asList(await qre<unknown>(`/inventory/assets${qs ? `?${qs}` : ''}`)),
  })
  const all = allQuery.data ?? []
  const rows = (query.data ?? []).filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['asset_id', 'asset_class', 'provider_id', 'lifecycle_state', 'execution_class'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const active = all.filter((row) => String(row.lifecycle_state || '') === 'active').length
  const maintenance = all.filter((row) => ['maintenance', 'suspended'].includes(String(row.lifecycle_state || ''))).length
  const providers = new Set(all.map((row) => String(row.provider_id || '')).filter(Boolean)).size
  const lifeChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.lifecycle_state || 'unknown')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name: stateLabel(name),
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [all])
  const execChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.execution_class || 'unknown')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [all])
  return (
    <Page
      crumbs={[{ label: 'Catalogue', to: '/qrp/inventory' }, { label: 'Inventory' }]}
      title="Inventory"
      actions={
        <span className="flex flex-wrap gap-2">
          <Link className="btn-primary" to="/qrp/inventory/new">
            Register asset
          </Link>
          <Link className="btn-secondary" to="/qrp/inventory/import">
            Import
          </Link>
        </span>
      }
      updatedAt={allQuery.dataUpdatedAt || query.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="Registered" value={allQuery.isError ? '—' : all.length} hint="Unfiltered catalogue" />
        <MetricTile label="Active" value={allQuery.isError ? '—' : active} hint="Lifecycle = active" tone="success" />
        <MetricTile label="Service / hold" value={allQuery.isError ? '—' : maintenance} hint="Maintenance or suspended" tone={maintenance ? 'warning' : 'neutral'} />
        <MetricTile label="Providers linked" value={allQuery.isError ? '—' : providers} hint="Distinct provider_id" />
      </KpiStrip>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel title="Lifecycle mix" empty={allQuery.isPending || lifeChart.length === 0}>
          {(h) =>
            allQuery.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : lifeChart.length === 0 ? (
              <EmptyState title="No assets" body="Register or import to populate lifecycle." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <PieChart>
                  <Pie data={lifeChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                    {lifeChart.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
        <ChartPanel className="xl:col-span-2" title="By execution class" empty={execChart.length === 0}>
          {(h) =>
            execChart.length === 0 ? (
              <EmptyState title="No execution classes" body="Empty inventory." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={execChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
      </div>
      <Card>
        <FilterBar
          options={INVENTORY_EXEC}
          value={exec}
          onChange={(id) => setExec(id as (typeof INVENTORY_EXEC)[number]['id'])}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search assets…"
          defaultId="all"
          trailing={
            <span className="flex flex-wrap gap-2">
              {INVENTORY_LIFE.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={life === opt.id ? 'btn-secondary' : 'btn-ghost'}
                  aria-pressed={life === opt.id}
                  onClick={() => setLife(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </span>
          }
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No assets"
            emptyBody="Register an asset or import a provider catalogue. Empty ≠ zero capacity elsewhere."
            columns={[
              {
                key: 'asset_id',
                label: 'Asset',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/inventory/${row.asset_id}`}>
                      {shortId(String(row.asset_id || ''), 12)}
                    </Link>
                    <CopyableId value={String(row.asset_id || '')} />
                  </span>
                ),
              },
              { key: 'asset_class', label: 'Class', sortable: true },
              { key: 'execution_class', label: 'Execution', sortable: true },
              {
                key: 'lifecycle_state',
                label: 'Lifecycle',
                sortable: true,
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.lifecycle_state || ''))} label={stateLabel(String(row.lifecycle_state || 'registered'))} />
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
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function ProvidersPage() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const query = useRows('providers', '/providers')
  const all = query.data ?? []
  const statusOptions = useMemo(() => {
    const ids = Array.from(new Set(all.map((row) => String(row.status || '').toLowerCase()).filter(Boolean))).sort()
    return [{ id: 'all', label: 'All status' }, ...ids.map((id) => ({ id, label: stateLabel(id) }))]
  }, [all])
  const rows = all.filter((row) => {
    if (status !== 'all' && String(row.status || '').toLowerCase() !== status) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['provider_name', 'provider_id', 'status'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const active = all.filter((row) => String(row.status || '').toLowerCase() === 'active').length
  const withManifest = all.filter((row) => Boolean((row.integration as Row | undefined)?.manifest_registered)).length
  const collectorOk = all.filter((row) => String((row.integration as Row | undefined)?.collector_last_status || '').toUpperCase() === 'OK').length
  const stageChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const stage = String((row.integration as Row | undefined)?.stage || '—')
      counts.set(stage, (counts.get(stage) || 0) + 1)
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
      title="Providers"
      actions={
        <span className="flex flex-wrap gap-2">
          <Link className="btn-secondary" to="/qrp/providers/onboarding">
            Onboarding board
          </Link>
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="Providers" value={query.isError ? '—' : all.length} hint="Catalogue rows" />
        <MetricTile label="Active" value={query.isError ? '—' : active} hint="Status = active" tone="success" />
        <MetricTile label="Manifest on file" value={query.isError ? '—' : withManifest} hint="integration.manifest_registered" />
        <MetricTile label="Collector OK" value={query.isError ? '—' : collectorOk} hint="Last collector status" tone={collectorOk ? 'success' : 'neutral'} />
      </KpiStrip>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel
          title="Integration stage"
          empty={stageChart.length === 0}
          action={
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/connectors">
              I1–I5 legend
            </Link>
          }
        >
          {(h) =>
            stageChart.length === 0 ? (
              <EmptyState title="No stages" body="Empty provider catalogue." />
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
        <Card className="xl:col-span-2 space-y-2 text-sm">
          <PanelHeader title="Next steps" />
          <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
            <li>Open a provider → publish capability manifest (moves toward I2).</li>
            <li>Confirm collector runs on Connectors (I3 evidence).</li>
            <li>Activate / suspend from provider detail — catalogue status ≠ dispatch claim.</li>
          </ol>
          <Link className="font-medium text-primary hover:underline" to="/qrp/connectors">
            Open connectors →
          </Link>
        </Card>
      </div>
      <Card>
        <FilterBar
          options={statusOptions}
          value={status}
          onChange={setStatus}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search providers…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No providers yet"
            emptyBody="Providers appear after registration. Open a row to publish a manifest and activate."
            columns={[
              {
                key: 'provider_name',
                label: 'Provider',
                render: (row) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/providers/${row.provider_id}`}>
                    {text(row, 'provider_name') === '—' ? text(row, 'provider_id') : text(row, 'provider_name')}
                  </Link>
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
                render: (row) => <span className="font-mono text-xs">{text((row.integration as Row | undefined) ?? {}, 'stage')}</span>,
              },
              {
                key: 'collector',
                label: 'Collector',
                render: (row) => {
                  const statusText = text((row.integration as Row | undefined) ?? {}, 'collector_last_status')
                  return statusText === '—' ? <span className="text-muted-foreground">Unavailable</span> : statusText
                },
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={stateTone(String(row.status || 'active'))} label={stateLabel(String(row.status || 'active'))} />,
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function ProjectsPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'cards'>('table')
  const query = useRows('projects', '/projects')
  const summary = useQuery({
    queryKey: ['governance-summary-projects'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
  })
  const approvals = useQuery({
    queryKey: ['approvals-projects-strip'],
    queryFn: async () => asList(await qre<unknown>('/approvals')),
    retry: false,
  })
  const create = useMutation({
    mutationFn: () =>
      qre<Row>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
          project_type: 'quantum_circuit',
        }),
      }),
    onSuccess: (row) => {
      setName('')
      setDescription('')
      setCreateOpen(false)
      void client.invalidateQueries({ queryKey: ['projects'] })
      if (row.project_id) navigate(`/qrp/projects/${row.project_id}`)
    },
  })
  const all = query.data ?? []
  const rows = all.filter((row) => {
    if (filter === 'active' && row.is_archived) return false
    if (filter === 'archived' && !row.is_archived) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['name', 'project_id', 'owner_username', 'project_type'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const active = all.filter((row) => !row.is_archived).length
  const archived = all.filter((row) => row.is_archived).length
  const locked = all.filter((row) => Boolean(row.submission_lock)).length
  const owners = new Set(all.map((row) => String(row.owner_username || '')).filter(Boolean)).size
  const openReviews = (approvals.data ?? []).filter((r) =>
    ['submitted_for_review', 'in_review', 'changes_requested'].includes(String(r.governance_state || '')),
  ).length
  const typeChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.project_type || 'untyped')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
      .sort((a, b) => b.value - a.value)
  }, [all])
  const requestByProject = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of approvals.data ?? []) {
      const pid = String(row.project_id || '')
      if (!pid) continue
      counts.set(pid, (counts.get(pid) || 0) + 1)
    }
    return counts
  }, [approvals.data])
  return (
    <Page
      crumbs={[{ label: 'Review', to: '/qrp/approvals' }, { label: 'Projects' }]}
      title="Projects"
      actions={
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          New project
        </button>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <Modal open={createOpen} title="New project" onClose={() => setCreateOpen(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <input
            required
            className="field-input w-full"
            value={name}
            placeholder="Project name"
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <input
            className="field-input w-full"
            value={description}
            placeholder="Description (optional)"
            onChange={(event) => setDescription(event.target.value)}
          />
          {create.error ? <p className="text-sm text-critical">{message(create.error)}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
      <KpiStrip className="xl:grid-cols-5">
        <MetricTile label="Projects" value={query.isError ? '—' : all.length} />
        <MetricTile label="Active" value={query.isError ? '—' : active} tone="success" />
        <MetricTile label="Locked" value={query.isError ? '—' : locked} tone={locked ? 'warning' : 'neutral'} />
        <MetricTile label="Archived" value={query.isError ? '—' : archived} />
        <MetricTile
          label="Open reviews"
          value={approvals.isError ? (summary.isError ? '—' : summary.data?.queue) : openReviews}
          hint={`${owners} owners`}
          tone="primary"
        />
      </KpiStrip>
      {typeChart.length > 0 ? (
        <ChartPanel title="By type" empty={false}>
          {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <BarChart data={typeChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      ) : null}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <FilterBar
            options={[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'archived', label: 'Archived' },
            ]}
            value={filter}
            onChange={setFilter}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search projects…"
            defaultId="all"
          />
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <button type="button" className={view === 'table' ? 'btn-secondary' : 'btn-ghost'} onClick={() => setView('table')}>
              Table
            </button>
            <button type="button" className={view === 'cards' ? 'btn-secondary' : 'btn-ghost'} onClick={() => setView('cards')}>
              Cards
            </button>
          </div>
        </div>
        <QueryBody query={query}>
          {view === 'table' ? (
            <Table
              rows={rows}
              emptyTitle="No projects"
              emptyBody="Create a project to own workloads and reservations."
              columns={[
                {
                  key: 'name',
                  label: 'Project',
                  render: (row) => (
                    <span className="flex flex-col gap-0.5">
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        {text(row, 'name')}
                      </Link>
                      <span className="text-xs text-muted-foreground">{text(row, 'slug')}</span>
                    </span>
                  ),
                },
                {
                  key: 'project_id',
                  label: 'Id',
                  render: (row) => <CopyableId value={String(row.project_id || '')} />,
                },
                { key: 'owner_username', label: 'Owner / PI' },
                {
                  key: 'project_type',
                  label: 'Type',
                  render: (row) => <span className="text-xs">{String(row.project_type || '—').replace(/_/g, ' ')}</span>,
                },
                {
                  key: 'requests',
                  label: 'Requests',
                  render: (row) => (
                    <span className="tabular-nums">{requestByProject.get(String(row.project_id || '')) ?? (approvals.isError ? '—' : 0)}</span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => (
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge tone={row.is_archived ? 'warning' : 'success'} label={row.is_archived ? 'Archived' : 'Active'} />
                      {row.submission_lock ? <StatusBadge tone="warning" label="Locked" /> : null}
                    </span>
                  ),
                },
                {
                  key: 'updated_at',
                  label: 'Updated',
                  render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{text(row, 'updated_at')}</span>,
                },
              ]}
            />
          ) : rows.length === 0 ? (
            <EmptyState title="No projects" body="Create a project to own workloads and reservations." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <Link
                  key={String(row.project_id)}
                  to={`/qrp/projects/${row.project_id}`}
                  className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{text(row, 'name')}</p>
                    <StatusBadge tone={row.is_archived ? 'warning' : 'success'} label={row.is_archived ? 'Archived' : 'Active'} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{text(row, 'owner_username') || 'No owner'} · {String(row.project_type || '').replace(/_/g, ' ')}</p>
                  <p className="mt-3 text-sm tabular-nums text-muted-foreground">
                    {requestByProject.get(String(row.project_id || '')) ?? 0} linked request(s)
                    {row.submission_lock ? ' · submission locked' : ''}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{text(row, 'description') || 'Open hub for members, requests, holds, usage.'}</p>
                </Link>
              ))}
            </div>
          )}
        </QueryBody>
      </Card>
    </Page>
  )
}

export function PoliciesPage() {
  const query = useQuery({
    queryKey: ['policy'],
    queryFn: () => qre<Row>('/approvals/policy'),
  })
  const summary = useQuery({
    queryKey: ['governance-summary-policies'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
  })
  const stages = Array.isArray(query.data?.stages) ? (query.data?.stages as Row[]) : []
  const counts = (summary.data?.counts as Row | undefined) ?? {}
  return (
    <Page
      crumbs={[{ label: 'Govern', to: '/qrp/policies' }, { label: 'Policies' }]}
      title="Policies"
      actions={
        <Link className="btn-primary" to="/qrp/approvals">
          Review queue
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="In queue" value={summary.isError ? '—' : summary.data?.queue} tone="primary" />
        <MetricTile label="In review" value={summary.isError ? '—' : counts.in_review} />
        <MetricTile label="Approved" value={summary.isError ? '—' : counts.approved} tone="success" />
        <MetricTile label="Rejected" value={summary.isError ? '—' : counts.rejected} tone="critical" />
      </div>
      <QueryBody query={query}>
        <Card className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Policy</dt>
              <dd className="mt-1 flex items-center gap-2 font-mono text-xs">
                {text(query.data ?? {}, 'policy_id')}
                <CopyableId value={String(query.data?.policy_id || '')} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Version</dt>
              <dd className="mt-1 font-medium">{text(query.data ?? {}, 'version')}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Stages</dt>
              <dd className="mt-1 tabular-nums font-medium">{stages.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Name</dt>
              <dd className="mt-1 font-medium">{text(query.data ?? {}, 'name')}</dd>
            </div>
          </dl>
          {stages.length > 0 && (
            <ol className="flex flex-wrap gap-2" aria-label="Policy stage order">
              {stages.map((stage, index) => (
                <li
                  key={String(stage.id || index)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-medium">{text(stage, 'label')}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{text(stage, 'id')}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <Table
            rows={stages}
            emptyTitle="No stages published"
            emptyBody="The approval policy has no stages yet."
            columns={[
              { key: 'id', label: 'Stage' },
              { key: 'label', label: 'Label' },
              { key: 'required_permission', label: 'Permission' },
            ]}
          />
        </Card>
      </QueryBody>
    </Page>
  )
}

const QUOTA_WINDOWS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All' },
] as const

export function QuotasPage() {
  const [windowId, setWindowId] = useState<(typeof QUOTA_WINDOWS)[number]['id']>('today')
  const query = useQuery({
    queryKey: ['quota-ledger', windowId],
    queryFn: () => qre<Row>(`/quotas/ledger?window=${encodeURIComponent(windowId)}`),
  })
  const data = query.data ?? {}
  const projects = asList(data.by_project)
  const entries = asList(data.entries)
  const cap = Number(data.daily_shots_cap)
  const used = Number(data.used_shots)
  const warnAt = Number(data.warn_threshold_pct)
  const barPct =
    Number.isFinite(cap) && cap > 0 && Number.isFinite(used) ? Math.min(100, Math.round((used / cap) * 100)) : null
  const nearWarn = barPct != null && Number.isFinite(warnAt) && barPct >= warnAt
  return (
    <Page
      eyebrow="Governance"
      title="Quotas"
      updatedAt={query.dataUpdatedAt}
    >
      <FilterBar
        options={QUOTA_WINDOWS}
        value={windowId}
        onChange={(id) => setWindowId(id as (typeof QUOTA_WINDOWS)[number]['id'])}
        defaultId="today"
      />
      <QueryBody query={query}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Cap" value={data.daily_shots_cap} hint="Institution shot budget" />
          <MetricTile label="Used" value={data.used_shots} hint="Completed jobs in window" tone="warning" />
          <MetricTile label="Remaining" value={data.remaining_shots} hint="Headroom before deny" tone="success" />
          <MetricTile
            label="Headroom %"
            value={data.headroom_pct}
            hint={nearWarn ? `At/above warn ${warnAt}%` : 'Remaining / cap'}
            tone={nearWarn ? 'warning' : 'primary'}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-2 lg:col-span-2">
            <PanelHeader title="Usage vs cap" />
            {barPct != null ? (
              <>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={barPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={cn('h-full rounded-full transition-[width]', nearWarn ? 'bg-warning' : 'bg-primary')}
                    style={{ width: `${Math.max(barPct, used > 0 ? barPct : 0)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {String(data.used_shots)} / {String(data.daily_shots_cap)} shots ({barPct}%) · window {String(data.window || windowId)}
                </p>
              </>
            ) : null}
            <dl className="grid gap-2 border-t border-border/70 pt-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Window (UTC)</dt>
                <dd className="mt-1 font-mono text-xs">
                  {text(data, 'window_start')} → {text(data, 'window_end')}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Warn threshold</dt>
                <dd className="mt-1 tabular-nums">{Number.isFinite(warnAt) ? `${warnAt}%` : '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Lifetime used</dt>
                <dd className="mt-1 tabular-nums">{String(data.used_shots_lifetime ?? '—')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Entries in sample</dt>
                <dd className="mt-1 tabular-nums">{String(data.entry_count ?? entries.length)}</dd>
              </div>
            </dl>
          </Card>
          <Card className="space-y-2 text-sm">
            <PanelHeader title="Policy" />
            <p>
              <span className="text-muted-foreground">Policy </span>
              <span className="font-mono text-xs">{text(data, 'policy_id')}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Kind </span>
              {text(data, 'ledger_kind')}
            </p>
            <p>
              <span className="text-muted-foreground">Dimension </span>
              {text(data, 'dimension')}
            </p>
            <p className="text-xs leading-snug text-muted-foreground">{text(data, 'dimension_note')}</p>
            <p className="text-xs text-muted-foreground">Tenant {text(data, 'tenant_id')}</p>
            {used === 0 && (
              <EmptyState
                title="No consumption yet"
                body="Approve and complete simulation jobs to see project rollups. Missing meters stay unavailable — never invented as zero usage elsewhere."
                action={
                  <Link className="btn-secondary" to="/qrp">
                    Overview · Load demo
                  </Link>
                }
              />
            )}
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <PanelHeader
              title="By project"
              action={<span className="text-xs text-muted-foreground tabular-nums">{projects.length} rows</span>}
            />
            <Table
              rows={projects}
              emptyTitle="No project usage in this window"
              emptyBody={
                <>
                  Rollups appear after completed simulation jobs. Check{' '}
                  <Link className="font-medium text-primary hover:underline" to="/qrp/metering">
                    Metering
                  </Link>{' '}
                  or open a project and submit for review.
                </>
              }
              columns={[
                {
                  key: 'project_name',
                  label: 'Project',
                  render: (row) =>
                    row.project_id ? (
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        {text(row, 'project_name')}
                      </Link>
                    ) : (
                      text(row, 'project_name')
                    ),
                },
                { key: 'shots', label: 'Shots', sortable: true },
                { key: 'jobs', label: 'Jobs', sortable: true },
              ]}
            />
          </Card>
          <Card>
            <PanelHeader
              title="Jobs in window"
              action={<span className="text-xs text-muted-foreground tabular-nums">{entries.length} rows</span>}
            />
            <Table
              rows={entries}
              emptyTitle="No ledger entries"
              emptyBody="Completed simulation jobs that consume the daily cap appear here with requester and shot count."
              columns={[
                { key: 'project_name', label: 'Project' },
                { key: 'shots', label: 'Shots', sortable: true },
                { key: 'status', label: 'Status' },
                { key: 'created_by', label: 'By' },
              ]}
            />
          </Card>
        </div>
      </QueryBody>
    </Page>
  )
}

const RESERVATION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Requested' },
  { id: 'active', label: 'Active' },
  { id: 'released', label: 'Released' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

export function ReservationsPage() {
  const client = useQueryClient()
  const [filter, setFilter] = useState<(typeof RESERVATION_FILTERS)[number]['id']>('all')
  const [view, setView] = useState<'list' | 'calendar'>('calendar')
  const [search, setSearch] = useState('')
  const path = filter === 'all' ? '/reservations' : `/reservations?state=${encodeURIComponent(filter)}`
  const query = useQuery({
    queryKey: ['reservations', filter],
    queryFn: () => qre<{ items?: Row[]; transitions?: Record<string, string[]>; conflict_count?: number }>(path),
  })
  const move = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      qre(`/reservations/${encodeURIComponent(id)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ state }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['reservations'] }),
  })
  const transitions = query.data?.transitions ?? {}
  const allRows = asList(query.data)
  const conflictCount =
    typeof query.data?.conflict_count === 'number'
      ? query.data.conflict_count
      : allRows.filter((r) => r.has_conflict).length
  const q = search.trim().toLowerCase()
  const rows = q
    ? allRows.filter((row) =>
        ['reservation_id', 'resource_ref', 'purpose', 'project_id', 'state', 'created_by'].some((key) =>
          String(row[key] ?? '')
            .toLowerCase()
            .includes(q),
        ),
      )
    : allRows
  const countFor = (state: string) => allRows.filter((r) => String(r.state) === state).length
  return (
    <Page
      eyebrow="Governance · Allocation"
      title="Reservations"
      actions={
        <span className="flex flex-wrap gap-2">
          <Link to="/qrp/scheduling" className="btn-primary">
            Request a window
          </Link>
          
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Requested" value={countFor('requested')} hint="Awaiting activate" tone="warning" />
        <MetricTile label="Active" value={countFor('active')} hint="Hold in force" tone="success" />
        <MetricTile label="Released" value={countFor('released')} hint="Terminal" />
        <MetricTile label="Cancelled" value={countFor('cancelled')} hint="Terminal" tone="critical" />
        <MetricTile label="Conflicts" value={conflictCount} hint="Overlapping holds" tone={conflictCount ? 'critical' : 'neutral'} />
      </div>
      {conflictCount > 0 && (
        <Notice tone="warning">{conflictCount} overlapping reservation(s) flagged. Overlaps are not auto-cancelled.</Notice>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FilterBar
            options={RESERVATION_FILTERS}
            value={filter}
            onChange={(id) => setFilter(id as (typeof RESERVATION_FILTERS)[number]['id'])}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Resource, purpose, project…"
            defaultId="all"
          />
          <div className="ms-auto flex gap-1 rounded-lg border border-border p-0.5" role="tablist" aria-label="Reservation view">
            <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'btn-secondary' : 'btn-ghost'} onClick={() => setView('list')}>
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'calendar'}
              className={view === 'calendar' ? 'btn-secondary' : 'btn-ghost'}
              onClick={() => setView('calendar')}
            >
              Calendar
            </button>
          </div>
        </div>
        <QueryBody query={query}>
          {view === 'calendar' ? (
            <ReservationCalendar rows={rows} />
          ) : (
            <Table
              rows={rows}
              emptyTitle="No reservations"
              emptyBody="Request a window to hold capacity for a project resource."
              columns={[
                {
                  key: 'reservation_id',
                  label: 'Reservation',
                  render: (row) => <CopyableId value={String(row.reservation_id || '')} keep={10} />,
                },
                { key: 'resource_ref', label: 'Resource', sortable: true },
                {
                  key: 'project_id',
                  label: 'Project',
                  render: (row) =>
                    row.project_id ? (
                      <Link className="hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        {shortId(String(row.project_id), 10)}
                      </Link>
                    ) : (
                      '—'
                    ),
                },
                { key: 'window_start', label: 'Start', sortable: true },
                { key: 'window_end', label: 'End', sortable: true },
                {
                  key: 'state',
                  label: 'State',
                  render: (row) => <StatusBadge tone={stateTone(String(row.state || ''))} label={stateLabel(String(row.state || 'requested'))} />,
                },
                {
                  key: 'has_conflict',
                  label: 'Conflict',
                  render: (row) =>
                    row.has_conflict ? <StatusBadge tone="critical" label="Overlap" /> : <span className="text-muted-foreground">—</span>,
                },
                { key: 'purpose', label: 'Purpose' },
                {
                  key: 'move',
                  label: 'Move',
                  render: (row) => (
                    <span className="flex flex-wrap gap-2">
                      {(transitions[String(row.state)] ?? []).map((state) => (
                        <button
                          key={state}
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            if (window.confirm(`Move reservation to ${state}?`)) {
                              move.mutate({ id: String(row.reservation_id), state })
                            }
                          }}
                        >
                          {stateLabel(state)}
                        </button>
                      ))}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </QueryBody>
        {move.error && <p className="mt-3 text-sm text-critical">{message(move.error)}</p>}
      </Card>
    </Page>
  )
}

const METER_HOURS = [
  { id: '24', label: '24 h' },
  { id: '72', label: '72 h' },
  { id: '168', label: '7 d' },
] as const

export function MeteringPage() {
  const [hours, setHours] = useState<(typeof METER_HOURS)[number]['id']>('24')
  const query = useQuery({
    queryKey: ['meter-rollups', hours],
    queryFn: () => qre<Row>(`/meter-rollups?hours=${hours}`),
  })
  const exportCsv = useMutation({
    mutationFn: () =>
      qreDownload(`/meter-rollups/export?hours=${hours}`, `meter-rollups-${hours}h-${new Date().toISOString().slice(0, 10)}.csv`),
  })
  const rows = asList(query.data)
  const envelope = query.data ?? {}
  const sampleCount = Number(envelope.sample_count ?? rows.length)
  const dimensions = new Set(rows.map((row) => String(row.dimension || '')).filter(Boolean)).size
  const metrics = new Set(rows.map((row) => String(row.metric || '')).filter(Boolean)).size
  const chart = useMemo(() => {
    const source = asList(query.data)
    return source
      .map((row) => ({
        name: `${String(row.metric || '?')}`.slice(0, 18),
        value: Number(row.sum_value),
        samples: Number(row.available_samples) || 0,
        unit: String(row.unit || ''),
      }))
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [query.data])
  return (
    <Page
      eyebrow="Governance"
      title="Metering"
      actions={
        <span className="flex flex-wrap items-center gap-2">
          
          <button type="button" className="btn-secondary" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
            {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
          </button>
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      {exportCsv.error && <Notice>{message(exportCsv.error)}</Notice>}
      <FilterBar
        options={METER_HOURS}
        value={hours}
        onChange={(id) => setHours(id as (typeof METER_HOURS)[number]['id'])}
        defaultId="24"
      />
      <KpiStrip>
        <MetricTile label="Rollup rows" value={query.isError ? '—' : rows.length} hint={`Window ${hours} h`} />
        <MetricTile label="Samples" value={query.isError ? '—' : sampleCount} hint="Connector samples in window" />
        <MetricTile label="Dimensions" value={query.isError ? '—' : dimensions} hint="Distinct dimension keys" />
        <MetricTile label="Metrics" value={query.isError ? '—' : metrics} hint="Distinct metric keys" />
      </KpiStrip>
      {(envelope.since != null || envelope.window_hours != null) && (
        <p className="text-xs text-muted-foreground">
          Since {text(envelope, 'since')} · window_hours {text(envelope, 'window_hours')}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel
          className="xl:col-span-2"
          title="Top sums in window"
          empty={query.isError || query.isPending || chart.length === 0}
        >
          {(h) =>
            query.isError ? (
              <EmptyState title="Metering unavailable" body={message(query.error)} />
            ) : query.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : chart.length === 0 ? (
              <EmptyState title="No numeric sums" body={`No rollups with sum_value in last ${hours} h. Empty ≠ zero.`} />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, _n, item) => [v, (item?.payload as { unit?: string } | undefined)?.unit || 'sum']} />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
        <Card>
          <PanelHeader title="How to read" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Rollups come from connector meters — not invented portal math.</li>
            <li>Daily shot cap lives on Quotas; this page is broader usage telemetry.</li>
            <li>Empty window means no samples returned, not that usage was zero.</li>
          </ul>
          <Link className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" to="/qrp/quotas">
            Open shot ledger →
          </Link>
        </Card>
      </div>
      <Card>
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No meter samples"
            emptyBody={`No rollups in the last ${hours} hours. Empty ≠ zero usage.`}
            columns={[
              { key: 'dimension', label: 'Dimension', sortable: true },
              { key: 'metric', label: 'Metric', sortable: true },
              { key: 'unit', label: 'Unit' },
              { key: 'sum_value', label: 'Sum', sortable: true },
              { key: 'available_samples', label: 'Samples', sortable: true },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function AuditPage() {
  const [search, setSearch] = useState('')
  const [prefix, setPrefix] = useState('all')
  const prefixOptions = [
    { id: 'all', label: 'All actions' },
    { id: 'approval', label: 'approval*' },
    { id: 'inventory', label: 'inventory*' },
    { id: 'quota', label: 'quota*' },
    { id: 'dispatch', label: 'dispatch*' },
    { id: 'user', label: 'user*' },
    { id: 'alert', label: 'alert*' },
  ]
  const path =
    prefix === 'all'
      ? '/governance/audit-events?limit=100'
      : `/governance/audit-events?limit=100&action_prefix=${encodeURIComponent(prefix)}`
  const query = useQuery({
    queryKey: ['audit', prefix],
    queryFn: async () => asList(await qre<unknown>(path)),
  })
  const exportCsv = useMutation({
    mutationFn: () => {
      const exportPath =
        prefix === 'all'
          ? '/governance/audit-events/export?limit=500'
          : `/governance/audit-events/export?limit=500&action_prefix=${encodeURIComponent(prefix)}`
      return qreDownload(exportPath, `audit-events-${new Date().toISOString().slice(0, 10)}.csv`)
    },
  })
  const all = query.data ?? []
  const rows = all.filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['actor', 'action', 'target_id', 'target_type', 'role'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const actors = new Set(all.map((row) => String(row.actor || '')).filter(Boolean)).size
  const actionChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const action = String(row.action || 'unknown')
      const family = action.includes('.') ? action.split('.')[0]! : action
      counts.set(family, (counts.get(family) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [all])
  return (
    <Page
      eyebrow="Records"
      title="Audit Trail"
      actions={
        <span className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
            {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
          </button>
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      {exportCsv.error && <Notice>{message(exportCsv.error)}</Notice>}
      <KpiStrip>
        <MetricTile label="Events (sample)" value={query.isError ? '—' : all.length} hint="Limit 100 / filter" />
        <MetricTile label="Distinct actors" value={query.isError ? '—' : actors} hint="In current sample" />
        <MetricTile label="Action families" value={query.isError ? '—' : actionChart.length} hint="Prefix before '.'" />
        <MetricTile label="Filter" value={prefix === 'all' ? 'all' : `${prefix}*`} hint="action_prefix" />
      </KpiStrip>
      {actionChart.length > 0 ? (
        <ChartPanel title="Action families in sample" empty={false}>
          {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <BarChart data={actionChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--chart-4)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      ) : null}
      <Card>
        <FilterBar
          options={prefixOptions}
          value={prefix}
          onChange={setPrefix}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search actor, action, target…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No audit events"
            emptyBody="Governance actions append here as operators work the queue."
            columns={[
              {
                key: 'timestamp',
                label: 'When',
                render: (row) => <span className="font-mono text-[11px]">{text(row, 'timestamp')}</span>,
              },
              { key: 'actor', label: 'Actor' },
              { key: 'role', label: 'Role' },
              { key: 'action', label: 'Action' },
              { key: 'target_type', label: 'Type' },
              {
                key: 'target_id',
                label: 'Target',
                render: (row) => (row.target_id ? <CopyableId value={String(row.target_id)} /> : '—'),
              },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function SupportPage() {
  const [severity, setSeverity] = useState('all')
  const [search, setSearch] = useState('')
  const query = useRows('alerts', '/alerts?status=ACTIVE&limit=50')
  const summary = useQuery({
    queryKey: ['alerts-summary-support'],
    queryFn: () => qre<Row>('/alerts/summary'),
    retry: false,
  })
  const backendChart = useMemo(() => {
    const by = (summary.data?.by_backend as Record<string, number> | undefined) ?? {}
    return Object.entries(by)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' ').slice(0, 18), value, full: name }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [summary.data])
  const rows = (query.data ?? []).filter((row) => {
    if (severity !== 'all' && String(row.severity || '').toUpperCase() !== severity) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['alert_id', 'severity', 'title', 'message', 'status', 'backend_id'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  return (
    <Page
      eyebrow="Operations"
      title="Alerts"
      actions={
        <span className="flex flex-wrap gap-2">
          <Link to="/qrp/incidents" className="btn-primary">
            Incidents
          </Link>
        </span>
      }
      updatedAt={query.dataUpdatedAt || summary.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="Active" value={summary.isError ? (query.data?.length ?? '—') : summary.data?.active} hint="Alerts summary" tone="warning" />
        <MetricTile label="Critical" value={summary.isError ? '—' : summary.data?.critical} hint="Needs immediate triage" tone="critical" />
        <MetricTile label="Warning" value={summary.isError ? '—' : summary.data?.warning} hint="Degraded posture" tone="warning" />
        <MetricTile label="Listed here" value={query.isError ? '—' : (query.data?.length ?? 0)} hint="Active sample (cap 50)" />
      </KpiStrip>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel
          className="xl:col-span-2"
          title="Active by backend"
          empty={summary.isError || summary.isPending || backendChart.length === 0}
          action={
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/incidents">
              Open incidents
            </Link>
          }
        >
          {(h) =>
            summary.isError ? (
              <EmptyState title="Summary unavailable" body={message(summary.error)} />
            ) : summary.isPending ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : backendChart.length === 0 ? (
              <EmptyState title="No active alerts" body="Fleet quiet on /alerts/summary." />
            ) : (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={backendChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v) => [v, 'Active alerts']}
                    labelFormatter={(_, p) => String((p?.[0]?.payload as { full?: string } | undefined)?.full || '')}
                  />
                  <Bar dataKey="value" fill="var(--chart-5)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartPanel>
        <Card className="space-y-2 text-sm">
          <PanelHeader title="Triage tip" />
          <p className="text-muted-foreground">
            Many WARNING rows can share one backend (coherence drop flood). Open Incidents to work the case, then drill a single alert only when needed.
          </p>
          <Link className="font-medium text-primary hover:underline" to="/qrp/backends">
            Browse backends →
          </Link>
        </Card>
      </div>
      <Card>
        <FilterBar
          options={[
            { id: 'all', label: 'All severities' },
            { id: 'CRITICAL', label: 'Critical' },
            { id: 'WARNING', label: 'Warning' },
          ]}
          value={severity}
          onChange={setSeverity}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search alerts…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No active alerts"
            emptyBody={search || severity !== 'all' ? 'No rows match filters.' : 'Fleet quiet.'}
            columns={[
              {
                key: 'alert_id',
                label: 'Alert',
                render: (row) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/support/${row.alert_id}`}>
                    {shortId(String(row.alert_id || ''), 12)}
                  </Link>
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
                    tone={String(row.severity).toLowerCase() === 'critical' ? 'critical' : 'warning'}
                    label={String(row.severity || 'info')}
                  />
                ),
              },
              {
                key: 'title',
                label: 'Title',
                render: (row) => (text(row, 'title') === '—' ? text(row, 'message') : text(row, 'title')),
              },
              { key: 'status', label: 'Status' },
            ]}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}

export function ProcurementPage() {
  return (
    <Page
      eyebrow="Not in operational scope"
      title="Procurement"
      actions={
        <span className="flex flex-wrap gap-2">
          <Link className="btn-primary" to="/qrp/inventory">
            Inventory
          </Link>
          <Link className="btn-secondary" to="/qrp/providers">
            Providers
          </Link>
        </span>
      }
    >
      <Notice tone="warning">
        Procurement stays charter-only until a formal scope change. Inventory and the daily shot ledger are the live capacity surfaces.
      </Notice>
    </Page>
  )
}
