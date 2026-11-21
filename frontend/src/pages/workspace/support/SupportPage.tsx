import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { qre, text } from '@/api/qre'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, EmptyState, MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { message, QueryBody, shortId, Table, useRows } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

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
      crumbs={[
        { label: 'Operations', to: '/qrp/centre' },
        { label: 'Alerts' },
      ]}
      title="Alerts"
      {...opsPageGuidance.support}
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
      <ChartPanel
        title="Active by backend"
        tip={opsPageGuidance.supportTriage.descriptionHelp}
        empty={summary.isError || summary.isPending || backendChart.length === 0}
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/incidents">
              Incidents
            </Link>
            <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/backends">
              Backends
            </Link>
          </span>
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
            emptyBody={search || severity !== 'all' ? 'No rows match filters.' : 'Organization-visible fleet quiet on this sample.'}
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
      <RelatedNav
        items={[
          { to: '/qrp/incidents', label: 'Incidents' },
          { to: '/qrp/centre', label: 'Operations centre' },
          { to: '/qrp/backends', label: 'Backends' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
