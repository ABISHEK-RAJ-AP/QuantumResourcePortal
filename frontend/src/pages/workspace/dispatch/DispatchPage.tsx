import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, EmptyState, MetricTile, Page, PanelHeader, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { needsReconcile } from '@/pages/workspace/dispatch/dispatch-shared'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function DispatchPage() {
  const [view, setView] = useState<'overview' | 'attempts' | 'contract'>('overview')
  const [attemptFilter, setAttemptFilter] = useState('all')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['dispatch-icd'],
    queryFn: () => qre<Row>('/dispatch-icd'),
  })
  const attempts = useQuery({
    queryKey: ['dispatch-attempts-icd'],
    queryFn: () => qre<unknown>('/dispatch-attempts'),
    retry: false,
  })
  const jobs = useQuery({
    queryKey: ['jobs-icd'],
    queryFn: () => qre<unknown>('/jobs?limit=50'),
    retry: false,
  })
  const outcomes = Array.isArray(query.data?.reconcile_outcomes) ? (query.data.reconcile_outcomes as string[]) : []
  const required = Array.isArray(query.data?.required_fields) ? (query.data.required_fields as string[]) : []
  const attemptRows = asList(attempts.data)
  const unresolved = attemptRows.filter((row) => {
    const state = String(row.dispatch_state || '')
    return state === 'dispatch_unresolved' || state === 'dispatch_authorized'
  }).length
  const confirmed = attemptRows.filter((row) => row.dispatch_state === 'dispatch_confirmed').length
  const failed = attemptRows.filter((row) => row.dispatch_state === 'dispatch_failed').length
  const jobRows = asList(jobs.data)
  const stateChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of attemptRows) {
      const key = stateLabel(String(row.dispatch_state || 'unknown'))
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [attemptRows])
  const filteredAttempts = attemptRows.filter((row) => {
    if (attemptFilter === 'needs' && !needsReconcile(row)) return false
    if (attemptFilter !== 'all' && attemptFilter !== 'needs' && String(row.dispatch_state || '') !== attemptFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['attempt_id', 'workload_id', 'backend_id', 'dispatch_state', 'external_job_id'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/approvals' },
        { label: 'Dispatch' },
      ]}
      title="Dispatch & Jobs"
      {...opsPageGuidance.dispatch}
      actions={
        unresolved > 0 ? (
          <Link to="/qrp/reconciliation" className="btn-primary">
            Reconcile ({unresolved})
          </Link>
        ) : undefined
      }
      updatedAt={attempts.dataUpdatedAt}
    >
      <KpiStrip>
        <MetricTile label="ICD version" value={query.isError ? '—' : text(query.data ?? {}, 'icd_version')} hint="Contract" />
        <MetricTile
          label="Live connector"
          value={query.isError ? '—' : query.data?.live_connector ? 'Claimed' : 'Off'}
          hint="I5 claim flag"
          tone={query.data?.live_connector ? 'success' : 'neutral'}
        />
        <MetricTile label="Needs reconcile" value={attempts.isError ? '—' : unresolved} hint="Authorized / unresolved" tone={unresolved ? 'critical' : 'neutral'} />
        <MetricTile label="Confirmed" value={attempts.isError ? '—' : confirmed} hint="External outcome" tone="success" />
        <MetricTile label="Provider jobs" value={jobs.isError ? '—' : jobRows.length} hint="Sample /jobs?limit=50" /></KpiStrip>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Dispatch views">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'attempts', label: `Attempts (${attemptRows.length})` },
            { id: 'contract', label: 'ICD contract' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={view === t.id}
            className={view === t.id ? 'chip-active' : 'btn-ghost'}
            onClick={() => setView(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <ChartPanel title="Attempt state mix" empty={stateChart.length === 0}>
              {(h) =>
                stateChart.length === 0 ? (
                  <EmptyState title="No attempts yet" body="Organization attempts appear after approve → authorize → record attempt." />
                ) : (
                  <ResponsiveContainer width="100%" height={h}>
                    <PieChart>
                      <Pie data={stateChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                        {stateChart.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )
              }
            </ChartPanel>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricTile label="Unresolved path" value={unresolved} hint="Needs operator" tone={unresolved ? 'critical' : 'neutral'} />
              <MetricTile label="Failed" value={failed} hint="Recorded failures" tone="warning" />
              <MetricTile label="Running jobs" value={jobRows.filter((r) => String(r.status || '').toUpperCase() === 'RUNNING').length} hint="Provider-reported" />
            </div>
          </div>
          <Card>
            <PanelHeader
              title="Operator path"
              action={
                <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/reconciliation">
                  Reconcile
                </Link>
              }
            />
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>Approve workload on Review Queue (organization governance only).</li>
              <li>Confirm reservation / eligibility, then authorise dispatch.</li>
              <li>Record durable attempt before connector call.</li>
              <li>Reconcile outcome — never blind retry ambiguous calls.</li>
              <li>Cross-check provider job when external_job_id exists.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => setView('attempts')}>
                Browse attempts
              </button>
            </div>
          </Card>
        </div>
      )}

      {view === 'attempts' && (
        <Card>
          <FilterBar
            options={[
              { id: 'all', label: 'All' },
              { id: 'needs', label: 'Needs reconcile' },
              { id: 'dispatch_confirmed', label: 'Confirmed' },
              { id: 'dispatch_failed', label: 'Failed' },
              { id: 'dispatch_unresolved', label: 'Unresolved' },
              { id: 'dispatch_authorized', label: 'Authorized' },
            ]}
            value={attemptFilter}
            onChange={setAttemptFilter}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search attempts…"
            defaultId="all"
          />
          <QueryBody query={attempts}>
            <Table
              rows={filteredAttempts}
              emptyTitle="No attempts"
              emptyBody="Organization dispatch attempts appear after authorisation and record-attempt."
              columns={[
                {
                  key: 'attempt_id',
                  label: 'Attempt',
                  render: (row) => <CopyableId value={String(row.attempt_id || '')} keep={10} />,
                },
                {
                  key: 'workload_id',
                  label: 'Request',
                  render: (row) =>
                    row.workload_id ? (
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                        {shortId(String(row.workload_id), 12)}
                      </Link>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'dispatch_state',
                  label: 'Governance / attempt',
                  render: (row) => (
                    <StatusBadge tone={stateTone(String(row.dispatch_state || ''))} label={stateLabel(String(row.dispatch_state || '—'))} />
                  ),
                },
                {
                  key: 'external_job_id',
                  label: 'Provider job',
                  render: (row) =>
                    row.external_job_id ? (
                      <Link className="font-mono text-xs text-primary hover:underline" to={`/qrp/jobs/${row.external_job_id}`}>
                        {text(row, 'external_job_id')}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not reported</span>
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
                  key: 'go',
                  label: 'Next',
                  render: (row) =>
                    needsReconcile(row) ? (
                      <Link className="text-sm font-medium text-primary hover:underline" to="/qrp/reconciliation">
                        Reconcile
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    ),
                },
              ]}
            />
          </QueryBody>
        </Card>
      )}

      {view === 'contract' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <QueryBody query={query}>
            <Card className="space-y-3 text-sm">
              <PanelHeader
                title="ICD endpoints"
                tip={text(query.data ?? {}, 'notes') !== '—' ? text(query.data ?? {}, 'notes') : 'Live dispatch contract paths and reconcile field requirements.'}
              />
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Reconcile outcomes</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {outcomes.length ? outcomes.map((o) => <StatusBadge key={o} tone="neutral" label={o} />) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Confirmed attempts</dt>
                  <dd className="mt-1 tabular-nums font-medium">{attempts.isError ? '—' : confirmed}</dd>
                </div>
              </dl>
              <p className="font-mono text-xs text-muted-foreground">{text(query.data ?? {}, 'authorize_dispatch')}</p>
              <p className="font-mono text-xs text-muted-foreground">{text(query.data ?? {}, 'record_attempt')}</p>
              <p className="font-mono text-xs text-muted-foreground">{text(query.data ?? {}, 'reconcile')}</p>
              {required.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Required fields</p>
                  <ul className="mt-1 list-inside list-disc font-mono text-xs text-muted-foreground">
                    {required.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </QueryBody>
          <Card className="space-y-3">
            <PanelHeader
              title="Safeguards"
              tip={
                <ul className="list-inside list-disc space-y-1.5 text-sm">
                  <li>Distinguish governance request from provider job.</li>
                  <li>Ambiguous timeout → unresolved, not auto-retry.</li>
                  <li>Confirmed requires provider-reported external_job_id when policy says so.</li>
                  <li>Connector capability gaps block submission — see Connectors.</li>
                </ul>
              }
            />
            <p className="text-sm text-muted-foreground">Governance vs provider job, reconcile, and connector gates.</p>
            <Link className="fs-link text-sm" to="/qrp/connectors">
              Connectors
            </Link>
          </Card>
        </div>
      )}
      <RelatedNav
        items={[
          { to: '/qrp/jobs', label: 'Provider jobs' },
          { to: '/qrp/reconciliation', label: 'Reconciliation' },
          { to: '/qrp/connectors', label: 'Connectors' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
