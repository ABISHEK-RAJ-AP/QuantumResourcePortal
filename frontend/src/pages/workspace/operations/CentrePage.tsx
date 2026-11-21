import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { ChartPanel } from '@/components/data/ChartPanel'
import { KpiStrip } from '@/components/data/KpiStrip'
import { useDemoOperationalPolling } from '@/hooks/useDemoOperationalPolling'
import { Card, EmptyState, MetricTile, Page, PanelHeader, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'

type Row = Record<string, unknown>

export function CentrePage() {
  const pollMs = useDemoOperationalPolling()
  const query = useQuery({
    queryKey: ['operations-centre'],
    queryFn: () => qre<Row>('/operations/centre'),
    refetchInterval: pollMs,
  })
  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
    refetchInterval: pollMs,
  })
  const attempts = useQuery({
    queryKey: ['dispatch-attempts-centre'],
    queryFn: () => qre<unknown>('/dispatch-attempts'),
    retry: false,
    refetchInterval: pollMs,
  })
  const queues = useQuery({
    queryKey: ['queues-centre'],
    queryFn: () => qre<unknown>('/queues'),
    retry: false,
    refetchInterval: pollMs,
  })
  const fleet = (query.data?.fleet as Row | undefined) ?? {}
  const ops = (query.data?.operations as Row | undefined) ?? {}
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
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [queues.data])
  const incidentRows = asList(query.data?.incidents)
  const showCharts = fleetChart.length > 0 || pendingChart.length > 0
  const queueCount = Number(summary.data?.queue ?? 0)
  const headerActions =
    queueCount > 0 ? (
      <Link className="btn-primary" to="/qrp/approvals">
        Review queue ({queueCount})
      </Link>
    ) : unresolved > 0 ? (
      <Link className="btn-primary" to="/qrp/reconciliation">
        Reconcile ({unresolved})
      </Link>
    ) : undefined
  return (
    <Page
      crumbs={[
        { label: 'Operations', to: '/qrp/centre' },
        { label: 'Operations centre' },
      ]}
      title="Operations Centre"
      {...opsPageGuidance.centre}
      actions={headerActions}
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile compact label="Approval queue" value={summary.isError ? '—' : summary.data?.queue} tone="primary" />
        <MetricTile
          compact
          label="Reconcile backlog"
          value={attempts.isError ? '—' : unresolved}
          tone={unresolved > 0 ? 'critical' : 'neutral'}
        />
        <MetricTile compact label="Pending jobs" value={queues.isError ? '—' : pendingTotal} tone={pendingTotal > 0 ? 'warning' : 'neutral'} />
        <MetricTile
          compact
          label="Fleet online"
          value={query.isError ? '—' : `${fleet.online ?? '—'}/${fleet.total ?? '—'}`}
          tone={Number(fleet.offline || 0) > 0 ? 'warning' : 'success'}
        />
        <MetricTile
          compact
          label="Active alerts"
          value={query.isError ? '—' : ops.active_alerts}
          tone={Number(ops.active_alerts || 0) > 0 ? 'warning' : 'neutral'}
        />
        <MetricTile
          compact
          label="Open incidents"
          value={query.isError ? '—' : ops.open_incidents}
          tone={Number(ops.open_incidents || 0) > 0 ? 'critical' : 'neutral'}
        />
      </KpiStrip>
      <QueryBody query={query}>
        {!showCharts && !query.isPending ? (
          <EmptyState
            title="No fleet or queue samples"
            body="Catalogue and queue telemetry appear here once backends are registered and sampled."
          />
        ) : null}
        {showCharts ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {fleetChart.length > 0 ? (
              <ChartPanel title="Fleet reachability" empty={false}>
                {(h) => (
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
                    </p>
                  </>
                )}
              </ChartPanel>
            ) : null}
            {pendingChart.length > 0 ? (
              <ChartPanel
                title="Queue depth (top backends)"
                empty={false}
                action={
                  <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/jobs?tab=queues">
                    Jobs & queues
                  </Link>
                }
              >
                {(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={pendingChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={48} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartPanel>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <PanelHeader
              title="Collector providers"
              tip="Latest ingest run per provider — status, lineage, and detected backend count."
            >
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
            </PanelHeader>
          </Card>
          <Card>
            <PanelHeader
              title="Catalogue snapshot"
              tip="Backends visible to your organization at collection time."
              action={
                <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/backends">
                  Backends
                </Link>
              }
            >
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
            </PanelHeader>
          </Card>
        </div>

        {classical.length > 0 && (
          <Card>
            <PanelHeader
              title="Classical HPC hosts"
              tip="Host metrics for simulation backends — not QPU cryo telemetry."
            >
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
            </PanelHeader>
          </Card>
        )}

        {incidentRows.length > 0 ? (
        <Card>
          <PanelHeader title="Open incidents" tip="Exception cases still open on the operations queue.">
          <Table
            rows={incidentRows}
            emptyTitle="No open incidents"
            emptyBody=""
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
          </PanelHeader>
        </Card>
        ) : null}
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/reconciliation', label: 'Reconciliation' },
          { to: '/qrp/jobs', label: 'Jobs & queues' },
          { to: '/qrp/incidents', label: 'Incidents' },
          { to: '/qrp/inventory', label: 'Inventory' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}

