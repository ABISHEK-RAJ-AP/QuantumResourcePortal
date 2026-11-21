import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, EmptyState, MetricTile, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { JOB_STATUS_FILTERS } from '@/pages/workspace/operations/jobs-shared'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { QueuesPage } from '@/pages/workspace/operations/QueuesPage'

export function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'queues' ? 'queues' : 'jobs'
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
  const jobsBody = (
    <>
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
              <EmptyState title="No jobs" body="No provider jobs in this organization sample — submit workloads and dispatch after approval." />
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
    </>
  )
  return (
    <Page
      crumbs={[{ label: 'Compute', to: '/qrp/jobs' }, { label: tab === 'queues' ? 'Queues' : 'Jobs' }]}
      title={tab === 'queues' ? 'Queue depth' : 'Provider jobs'}
      {...(tab === 'queues' ? opsPageGuidance.jobsQueuesTab : opsPageGuidance.jobs)}
      updatedAt={query.dataUpdatedAt}
    >
      <RecordWorkspace
        layout="hub"
        tabs={[
          { id: 'jobs', label: 'Jobs', count: query.isError ? undefined : all.length },
          { id: 'queues', label: 'Queues' },
        ]}
        activeTab={tab}
        onTabChange={(id) => {
          if (id === 'jobs') setSearchParams({}, { replace: true })
          else setSearchParams({ tab: id }, { replace: true })
        }}
      >
        {tab === 'queues' ? <QueuesPage embedded /> : jobsBody}
      </RecordWorkspace>
      <RelatedNav
        items={[
          { to: '/qrp/centre', label: 'Operations centre' },
          { to: '/qrp/dispatch', label: 'Dispatch' },
          { to: '/qrp/backends', label: 'Backends' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}

