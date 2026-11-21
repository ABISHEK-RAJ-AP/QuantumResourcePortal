import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, qreDownload, text } from '@/api/qre'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Notice, Page, PanelHeader, RelatedNav } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { InfoTip } from '@/components/ui/InfoTip'
import { formatDateTime, formatEnum } from '@/lib/display'
import { message, QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

const METER_HOURS = [
  { id: '24', label: '24 h' },
  { id: '72', label: '72 h' },
  { id: '168', label: '7 d' },
] as const

function meterWindowLabel(hours: string) {
  return METER_HOURS.find((h) => h.id === hours)?.label ?? `${hours} h`
}

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
  const sampleCount = Number(envelope.sample_count ?? 0)
  const dimensions = new Set(rows.map((row) => String(row.dimension || '')).filter(Boolean)).size
  const metrics = new Set(rows.map((row) => String(row.metric || '')).filter(Boolean)).size
  const sinceRaw = envelope.since != null ? String(envelope.since) : ''
  const sinceLabel = sinceRaw ? formatDateTime(sinceRaw) : '—'
  const hasRollups = rows.length > 0
  const chart = useMemo(() => {
    return rows
      .map((row) => ({
        name: String(row.metric || 'unknown').replace(/_/g, ' '),
        fullName: String(row.metric || ''),
        value: Number(row.sum_value),
        samples: Number(row.available_samples) || 0,
        unit: String(row.unit || ''),
        dimension: String(row.dimension || ''),
      }))
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => b.value - a.value)
  }, [rows])

  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/audit' },
        { label: 'Metering' },
      ]}
      title="Metering"
      {...opsPageGuidance.metering}
      actions={
        <button
          type="button"
          className="btn-primary"
          disabled={exportCsv.isPending || !hasRollups}
          title={hasRollups ? 'Download rollups as CSV' : 'No rollups to export for this window'}
          onClick={() => exportCsv.mutate()}
        >
          {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
        </button>
      }
      updatedAt={query.dataUpdatedAt}
    >
      {exportCsv.error ? <Notice tone="critical">{message(exportCsv.error)}</Notice> : null}
      <FilterBar
        options={METER_HOURS}
        value={hours}
        onChange={(id) => setHours(id as (typeof METER_HOURS)[number]['id'])}
        defaultId="24"
      />

      <Card className="space-y-3 text-sm">
        <PanelHeader
          title="Reporting window"
          action={
            <InfoTip label="Window semantics">
              The API filters workloads and jobs with timestamps on or after the window start. Changing the window
              reloads rollups; an empty table means no qualifying records, not necessarily zero platform usage
              elsewhere.
            </InfoTip>
          }
        />
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Range</dt>
            <dd className="mt-0.5 font-medium">Last {meterWindowLabel(hours)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Starts</dt>
            <dd className="mt-0.5 font-mono text-xs">{sinceLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Sources in rollup</dt>
            <dd className="mt-0.5 text-muted-foreground">Organization-approved workloads · provider jobs</dd>
          </div>
        </dl>
      </Card>

      {hasRollups || query.isPending || query.isError ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Summary</span>
            <InfoTip label="KPI definitions">
              Rollup rows = returned dimension/metric pairs. Source records = underlying workload/job rows counted.
              Dimensions and metrics = distinct keys in the table below.
            </InfoTip>
          </div>
          <KpiStrip>
            <MetricTile label="Rollup rows" value={query.isError ? '—' : rows.length} />
            <MetricTile label="Source records" value={query.isError ? '—' : sampleCount} />
            <MetricTile label="Dimensions" value={query.isError ? '—' : dimensions} />
            <MetricTile label="Metrics" value={query.isError ? '—' : metrics} />
          </KpiStrip>
        </>
      ) : null}

      <QueryBody query={query} notReportedTitle="Metering unavailable">
        {!query.isPending && !query.isError && !hasRollups ? (
          <Card className="p-5 sm:p-8">
            <div className="mx-auto max-w-xl space-y-4 text-center">
              <StatusBadge tone="neutral" label="No data in window" />
              <h2 className="text-lg font-semibold tracking-tight">
                No usage rollups in the last {meterWindowLabel(hours)}
              </h2>
              <p className="text-sm text-muted-foreground">
                No rollups since <span className="font-mono text-xs text-foreground">{sinceLabel}</span>. Widen the
                window or complete jobs, then refresh. Shot caps live on{' '}
                <Link className="font-medium text-primary hover:underline" to="/qrp/quotas">
                  Quotas
                </Link>
                .
              </p>
              <nav className="flex flex-wrap justify-center gap-2 pt-2" aria-label="Next steps">
                <Link className="btn-primary text-sm" to="/qrp/approvals">
                  Review queue
                </Link>
                <Link className="btn-ghost text-sm" to="/qrp/jobs">
                  Provider jobs
                </Link>
                <Link className="btn-ghost text-sm" to="/qrp/quotas">
                  Shot ledger
                </Link>
                <Link className="btn-ghost text-sm" to="/qrp/organization">
                  Organization
                </Link>
              </nav>
            </div>
          </Card>
        ) : null}

        {hasRollups ? (
          <>
            <ChartPanel className="mb-4" title="Rollup totals" empty={false}>
              {(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => (String(v).length > 22 ? `${String(v).slice(0, 20)}…` : v)}
                    />
                    <Tooltip
                      formatter={(v, _n, item) => {
                        const p = item?.payload as { unit?: string; fullName?: string; dimension?: string } | undefined
                        return [`${v} ${p?.unit || ''}`.trim(), `${p?.dimension || '—'} · ${p?.fullName || ''}`]
                      }}
                    />
                    <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>

            <Card>
              <PanelHeader
                title="Rollup detail"
                action={
                  <InfoTip label="Columns">
                    dimension scopes the metric (usually tenant). sum_value aggregates usage in the window;
                    available_samples is how many underlying records contributed.
                  </InfoTip>
                }
              />
              <Table
                rows={rows}
                caption="Meter rollups"
                emptyTitle="No rollups"
                emptyBody="Try a longer window or approve workloads with shot metadata."
                columns={[
                  { key: 'dimension', label: 'Dimension', sortable: true },
                  {
                    key: 'metric',
                    label: 'Metric',
                    sortable: true,
                    render: (row) => <span className="font-medium">{formatEnum(String(row.metric || ''))}</span>,
                  },
                  { key: 'unit', label: 'Unit' },
                  {
                    key: 'sum_value',
                    label: 'Sum',
                    sortable: true,
                    render: (row) => (
                      <span className="tabular-nums font-semibold">
                        {row.sum_value == null || row.sum_value === '' ? '—' : String(row.sum_value)}
                      </span>
                    ),
                  },
                  {
                    key: 'available_samples',
                    label: 'Samples',
                    sortable: true,
                    render: (row) => <span className="tabular-nums">{text(row, 'available_samples')}</span>,
                  },
                ]}
              />
            </Card>
          </>
        ) : null}
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/quotas', label: 'Quotas' },
          { to: '/qrp/approvals', label: 'Review queue' },
          { to: '/qrp/audit', label: 'Audit trail' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
