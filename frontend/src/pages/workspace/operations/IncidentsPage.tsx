import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, EmptyState, MetricTile, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'

type Row = Record<string, unknown>

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
      crumbs={[{ label: 'Operations', to: '/qrp/centre' }, { label: 'Incidents' }]}
      title="Incidents"
      {...opsPageGuidance.incidents}
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
          hint={alertSummary.isError ? 'From incident rows' : `${String(alertSummary.data?.active ?? '—')} active (org-visible sample)`}
          tone="warning"
        /></KpiStrip>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="By severity" empty={severityChart.length === 0}>
          {(h) =>
            severityChart.length === 0 ? (
              <EmptyState title="No incidents" body="Organization cases appear when triage opens an incident." />
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
            emptyBody={search || status !== 'all' ? 'No rows match filters.' : 'Organization incidents appear when triage opens a case.'}
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
      <RelatedNav
        items={[
          { to: '/qrp/centre', label: 'Operations centre' },
          { to: '/qrp/support', label: 'Active alerts' },
          { to: '/qrp/jobs', label: 'Jobs & queues' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
