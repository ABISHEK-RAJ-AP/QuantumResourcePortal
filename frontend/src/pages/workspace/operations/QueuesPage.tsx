import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, EmptyState, MetricTile, Page, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { message, QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { formatQueueWait } from '@/pages/workspace/operations/queue-wait'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

export function QueuesPage({ embedded = false }: { embedded?: boolean }) {
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
  const body = (
    <>
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
    </>
  )
  if (embedded) return body
  return (
    <Page
      crumbs={[{ label: 'Compute', to: '/qrp/jobs' }, { label: 'Queues' }]}
      title="Queues"
      {...opsPageGuidance.queues}
      updatedAt={query.dataUpdatedAt}
    >
      {body}
    </Page>
  )
}

