import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, EmptyState, MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function ConnectorsPage({ embedded = false }: { embedded?: boolean }) {
  const [stage, setStage] = useState('all')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['connectors'],
    queryFn: () => qre<Row>('/connectors'),
  })
  const legend = useMemo(
    () => (query.data?.legend as Row | undefined) ?? {},
    [query.data?.legend],
  )
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
  const stageLegendTip = useMemo(() => {
    const entries = Object.entries(legend)
    if (entries.length === 0) return undefined
    return (
      <ul className="space-y-1.5 text-sm">
        {entries.map(([key, value]) => (
          <li key={key}>
            <span className="font-mono font-medium">{key}</span>
            <span className="text-muted-foreground"> — {String(value)}</span>
          </li>
        ))}
      </ul>
    )
  }, [legend])
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
  const body = (
    <>
      <KpiStrip>
        <MetricTile label="Connectors" value={query.isError ? '—' : all.length} hint="Mirrors providers" />
        <MetricTile label="Collector OK" value={query.isError ? '—' : collectorOk} hint="Last status" tone="success" />
        <MetricTile label="Backends detected" value={query.isError ? '—' : backendsDetected} hint="Sum of last runs" />
        <MetricTile label="Circuit open" value={query.isError ? '—' : circuitOpen} hint="Breaker state" tone={circuitOpen ? 'critical' : 'neutral'} /></KpiStrip>
      <QueryBody query={query}>
        <div className="grid gap-4">
          <ChartPanel title="Stage mix" tip={stageLegendTip} empty={stageChart.length === 0}>
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
            emptyBody="Connector rows mirror providers your organization can dispatch against."
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
    </>
  )
  if (embedded) return body
  return (
    <Page
      crumbs={[{ label: 'Resources', to: '/qrp/providers' }, { label: 'Connectors' }]}
      title="Connectors"
      {...opsPageGuidance.connectors}
      updatedAt={query.dataUpdatedAt}
    >
      {body}
      <RelatedNav
        items={[
          { to: '/qrp/providers', label: 'Providers' },
          { to: '/qrp/dispatch', label: 'Dispatch' },
          { to: '/qrp/metering', label: 'Metering' },
        ]}
      />
    </Page>
  )
}
