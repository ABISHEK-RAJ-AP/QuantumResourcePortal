import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { FilterBar } from '@/components/data/FilterBar'
import { Card, EmptyState, MetricTile, Notice, Page, PanelHeader, RelatedNav } from '@/components/layout/Page'
import { cn } from '@/lib/utils'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

const QUOTA_WINDOWS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All' },
] as const

export function QuotasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projectId = searchParams.get('project_id')?.trim() || ''
  const [windowId, setWindowId] = useState<(typeof QUOTA_WINDOWS)[number]['id']>('today')
  const query = useQuery({
    queryKey: ['quota-ledger', windowId, projectId],
    queryFn: () => {
      const params = new URLSearchParams({ window: windowId })
      if (projectId) params.set('project_id', projectId)
      return qre<Row>(`/quotas/ledger?${params}`)
    },
  })
  const data = query.data ?? {}
  const projects = asList(data.by_project)
  const entries = asList(data.entries)
  const cap = Number(data.daily_shots_cap)
  const used = Number(data.used_shots)
  const warnAt = Number(data.warn_threshold_pct)
  const barPct =
    Number.isFinite(cap) && cap > 0 && Number.isFinite(used) ? Math.min(100, Math.round((used / cap) * 100)) : null
  const nearWarn = barPct != null && Number.isFinite(warnAt) && barPct >= warnAt
  const entryCount = Number(data.entry_count ?? entries.length)
  const usageWithoutLedger = Number.isFinite(used) && used > 0 && entryCount === 0
  const clearProject = () => {
    setSearchParams({}, { replace: true })
  }
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/policies' },
        { label: 'Quotas' },
      ]}
      title="Quotas"
      {...opsPageGuidance.quotas}
      updatedAt={query.dataUpdatedAt}
    >
      {projectId ? (
        <Notice tone="warning">
          Ledger scoped to project <CopyableId value={projectId} keep={12} />{' '}
          <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${projectId}`}>
            Project hub
          </Link>
          <button type="button" className="btn-ghost ms-2 text-sm" onClick={clearProject}>
            Organization-wide
          </button>
        </Notice>
      ) : null}
      <FilterBar
        options={QUOTA_WINDOWS}
        value={windowId}
        onChange={(id) => setWindowId(id as (typeof QUOTA_WINDOWS)[number]['id'])}
        defaultId="today"
      />
      <QueryBody query={query}>
        {usageWithoutLedger ? (
          <Notice tone="warning">
            <p className="font-medium text-foreground">Usage total does not match the ledger sample</p>
            <p className="mt-1">
              Reported used shots are {String(data.used_shots)} but no job entries appear in this window. The rollup may come
              from metering while the ledger slice is empty or the governance API is only partially connected.
            </p>
          </Notice>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Cap" value={data.daily_shots_cap} hint="Organization daily shot budget" />
          <MetricTile label="Used" value={data.used_shots} hint="Completed jobs in window" tone="warning" />
          <MetricTile label="Remaining" value={data.remaining_shots} hint="Headroom before deny" tone="success" />
          <MetricTile
            label="Headroom %"
            value={data.headroom_pct}
            hint={nearWarn ? `At/above warn ${warnAt}%` : 'Remaining / cap'}
            tone={nearWarn ? 'warning' : 'primary'}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-2 lg:col-span-2">
            <PanelHeader title="Usage vs cap" />
            {barPct != null ? (
              <>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={barPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={cn('h-full rounded-full transition-[width]', nearWarn ? 'bg-warning' : 'bg-primary')}
                    style={{ width: `${Math.max(barPct, used > 0 ? barPct : 0)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {String(data.used_shots)} / {String(data.daily_shots_cap)} shots ({barPct}%) · window {String(data.window || windowId)}
                </p>
              </>
            ) : null}
            <dl className="grid gap-2 border-t border-border/70 pt-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Window (UTC)</dt>
                <dd className="mt-1 font-mono text-xs">
                  {text(data, 'window_start')} → {text(data, 'window_end')}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Warn threshold</dt>
                <dd className="mt-1 tabular-nums">{Number.isFinite(warnAt) ? `${warnAt}%` : '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Lifetime used</dt>
                <dd className="mt-1 tabular-nums">{String(data.used_shots_lifetime ?? '—')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Entries in sample</dt>
                <dd className="mt-1 tabular-nums">{String(data.entry_count ?? entries.length)}</dd>
              </div>
            </dl>
          </Card>
          <Card className="space-y-2 text-sm">
            <PanelHeader
              title="Policy"
              tip={
                text(data, 'dimension_note') !== '—'
                  ? text(data, 'dimension_note')
                  : 'Daily shot ledger for your organization; project drill-down is optional.'
              }
            />
            <p>
              <span className="text-muted-foreground">Policy </span>
              <span className="font-mono text-xs">{text(data, 'policy_id')}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Kind </span>
              {text(data, 'ledger_kind')}
            </p>
            <p>
              <span className="text-muted-foreground">Dimension </span>
              {text(data, 'dimension')}
            </p>
            <p className="text-xs text-muted-foreground">
              Organization <span className="font-mono">{text(data, 'tenant_id')}</span>
            </p>
            {used === 0 && (
              <EmptyState
                title="No consumption yet"
                body="Usage appears after approved simulation jobs complete."
                action={
                  <Link className="fs-link text-sm" to="/qrp/approvals">
                    Review queue
                  </Link>
                }
              />
            )}
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <PanelHeader
              title="By research project (optional)"
              action={<span className="text-xs text-muted-foreground tabular-nums">{projects.length} rows</span>}
            >
            <Table
              rows={projects}
              emptyTitle="No project usage in this window"
              emptyBody={
                <>
                  Rollups appear after completed simulation jobs. Check{' '}
                  <Link className="font-medium text-primary hover:underline" to="/qrp/metering">
                    Metering
                  </Link>{' '}
                  or open a project and submit for review.
                </>
              }
              columns={[
                {
                  key: 'project_name',
                  label: 'Project',
                  render: (row) =>
                    row.project_id ? (
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        {text(row, 'project_name')}
                      </Link>
                    ) : (
                      text(row, 'project_name')
                    ),
                },
                { key: 'shots', label: 'Shots', sortable: true },
                { key: 'jobs', label: 'Jobs', sortable: true },
              ]}
            />
            </PanelHeader>
          </Card>
          <Card>
            <PanelHeader
              title="Jobs in window"
              action={<span className="text-xs text-muted-foreground tabular-nums">{entries.length} rows</span>}
            >
            <Table
              rows={entries}
              emptyTitle="No ledger entries"
              emptyBody="Organization members' completed simulation jobs that consume the daily cap appear here with requester and shot count."
              columns={[
                { key: 'project_name', label: 'Project' },
                { key: 'shots', label: 'Shots', sortable: true },
                { key: 'status', label: 'Status' },
                { key: 'created_by', label: 'By' },
              ]}
            />
            </PanelHeader>
          </Card>
        </div>
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/metering', label: 'Metering' },
          { to: '/qrp/projects', label: 'Projects' },
          { to: '/qrp/policies', label: 'Policies' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
