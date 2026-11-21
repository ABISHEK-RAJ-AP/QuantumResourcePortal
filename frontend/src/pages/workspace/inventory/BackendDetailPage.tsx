import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { KpiStrip } from '@/components/data/KpiStrip'
import { useDemoOperationalPolling } from '@/hooks/useDemoOperationalPolling'
import { Card, MetricTile, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { formatQueueWait } from '@/pages/workspace/operations/queue-wait'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function BackendDetailPage() {
  const { backendId = '' } = useParams()
  const pollMs = useDemoOperationalPolling()
  const backend = useQuery({
    queryKey: ['backend', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}`),
    enabled: !!backendId,
  })
  const status = useQuery({
    queryKey: ['backend-status', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}/status`),
    enabled: !!backendId,
    refetchInterval: pollMs,
  })
  const queue = useQuery({
    queryKey: ['backend-queue', backendId],
    queryFn: () => qre<Row>(`/queues/${encodeURIComponent(backendId)}`),
    enabled: !!backendId,
    retry: false,
    refetchInterval: pollMs,
  })
  const topology = useQuery({
    queryKey: ['backend-topology', backendId],
    queryFn: () => qre<Row>(`/backends/${encodeURIComponent(backendId)}/topology`),
    enabled: !!backendId,
    refetchInterval: pollMs,
  })
  const alerts = useQuery({
    queryKey: ['alerts-summary-backend', backendId],
    queryFn: () => qre<Row>('/alerts/summary'),
    enabled: !!backendId,
    retry: false,
    refetchInterval: pollMs,
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
      title={String(backend.data?.backend_name || backendId)}
      {...opsPageGuidance.backendDetail}
      actions={<CopyableId value={backendId} keep={14} />}
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
      <RelatedNav
        items={[
          { to: '/qrp/backends', label: 'All backends' },
          { to: '/qrp/jobs?tab=queues', label: 'Queues' },
          { to: '/qrp/support', label: 'Alerts' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}

/** Exported for self-check — missing wait must never render as zero. */
