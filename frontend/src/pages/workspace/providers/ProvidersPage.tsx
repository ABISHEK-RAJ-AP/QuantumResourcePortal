import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { QueryBody, Table, useRows } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

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
      crumbs={[
        { label: 'Resources', to: '/qrp/providers' },
        { label: 'Providers' },
      ]}
      title="Providers"
      {...opsPageGuidance.providers}
      updatedAt={query.dataUpdatedAt}
    >
      <KpiStrip className="sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile compact label="Providers" value={query.isError ? '—' : all.length} />
        <MetricTile compact label="Active" value={query.isError ? '—' : active} tone="success" />
        <MetricTile compact label="Manifest" value={query.isError ? '—' : withManifest} />
        <MetricTile compact label="Collector OK" value={query.isError ? '—' : collectorOk} tone={collectorOk ? 'success' : 'neutral'} />
      </KpiStrip>
      {stageChart.length > 0 ? (
        <ChartPanel
          title="Integration stage"
          empty={false}
          action={
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/connectors">
              Connectors
            </Link>
          }
        >
          {(h) => (
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
          )}
        </ChartPanel>
      ) : null}
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
            emptyTitle="No providers in catalogue"
            emptyBody="Platform operators register providers on the shared fabric; your organization then maps inventory and connectors to them."
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
      <RelatedNav
        items={[
          { to: '/qrp/connectors', label: 'Connectors' },
          { to: '/qrp/providers/onboarding', label: 'Onboarding board' },
          { to: '/qrp/inventory', label: 'Inventory' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
