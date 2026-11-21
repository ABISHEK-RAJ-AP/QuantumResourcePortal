import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { PaginatedSlice } from '@/components/data/PaginatedSlice'
import { Card, EmptyState, MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { ProjectCreateWizard } from '@/components/workflow/ProjectCreateWizard'
import { scopedApprovalsPath } from '@/lib/projectScope'
import { QueryBody, Table, useRows } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function ProjectsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'cards'>('table')
  const query = useRows('projects', '/projects')
  const summary = useQuery({
    queryKey: ['governance-summary-projects'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
  })
  const approvals = useQuery({
    queryKey: ['approvals-projects-strip'],
    queryFn: async () => asList(await qre<unknown>('/approvals')),
    retry: false,
  })
  const all = query.data ?? []
  const rows = all.filter((row) => {
    if (filter === 'active' && row.is_archived) return false
    if (filter === 'archived' && !row.is_archived) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['name', 'project_id', 'owner_username', 'project_type'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const active = all.filter((row) => !row.is_archived).length
  const archived = all.filter((row) => row.is_archived).length
  const locked = all.filter((row) => Boolean(row.submission_lock)).length
  const owners = new Set(all.map((row) => String(row.owner_username || '')).filter(Boolean)).size
  const openReviews = (approvals.data ?? []).filter((r) =>
    ['submitted_for_review', 'in_review', 'changes_requested'].includes(String(r.governance_state || '')),
  ).length
  const typeChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.project_type || 'untyped')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
      .sort((a, b) => b.value - a.value)
  }, [all])
  const requestByProject = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of approvals.data ?? []) {
      const pid = String(row.project_id || '')
      if (!pid) continue
      counts.set(pid, (counts.get(pid) || 0) + 1)
    }
    return counts
  }, [approvals.data])
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/projects' },
        { label: 'Projects' },
      ]}
      title="Projects"
      {...opsPageGuidance.projects}
      actions={
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          New project
        </button>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <ProjectCreateWizard open={createOpen} onClose={() => setCreateOpen(false)} />
      <KpiStrip className="xl:grid-cols-5">
        <MetricTile label="Projects" value={query.isError ? '—' : all.length} />
        <MetricTile label="Active" value={query.isError ? '—' : active} tone="success" />
        <MetricTile label="Locked" value={query.isError ? '—' : locked} tone={locked ? 'warning' : 'neutral'} />
        <MetricTile label="Archived" value={query.isError ? '—' : archived} />
        <MetricTile
          label="Open reviews"
          value={approvals.isError ? (summary.isError ? '—' : summary.data?.queue) : openReviews}
          hint={`${owners} owners`}
          tone="primary"
        />
      </KpiStrip>
      {typeChart.length > 0 ? (
        <ChartPanel title="By type" empty={false}>
          {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <BarChart data={typeChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      ) : null}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <FilterBar
            options={[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'archived', label: 'Archived' },
            ]}
            value={filter}
            onChange={setFilter}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search projects…"
            defaultId="all"
          />
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <button type="button" className={view === 'table' ? 'chip-active' : 'btn-ghost'} onClick={() => setView('table')}>
              Table
            </button>
            <button type="button" className={view === 'cards' ? 'chip-active' : 'btn-ghost'} onClick={() => setView('cards')}>
              Cards
            </button>
          </div>
        </div>
        <QueryBody query={query}>
          {view === 'table' ? (
            <Table
              rows={rows}
              emptyTitle="No projects"
              emptyBody=""
              columns={[
                {
                  key: 'name',
                  label: 'Project',
                  render: (row) => (
                    <span className="flex flex-col gap-0.5">
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        {text(row, 'name')}
                      </Link>
                      <span className="text-xs text-muted-foreground">{text(row, 'slug')}</span>
                    </span>
                  ),
                },
                {
                  key: 'project_id',
                  label: 'Id',
                  render: (row) => <CopyableId value={String(row.project_id || '')} />,
                },
                { key: 'owner_username', label: 'Owner / PI' },
                {
                  key: 'project_type',
                  label: 'Type',
                  render: (row) => <span className="text-xs">{String(row.project_type || '—').replace(/_/g, ' ')}</span>,
                },
                {
                  key: 'requests',
                  label: 'Requests',
                  render: (row) => {
                    const pid = String(row.project_id || '')
                    const n = requestByProject.get(pid) ?? (approvals.isError ? null : 0)
                    if (!pid || n == null) return <span className="tabular-nums">{n ?? '—'}</span>
                    return (
                      <Link className="tabular-nums font-medium text-primary hover:underline" to={scopedApprovalsPath(pid)}>
                        {n}
                      </Link>
                    )
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => (
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge tone={row.is_archived ? 'warning' : 'success'} label={row.is_archived ? 'Archived' : 'Active'} />
                      {row.submission_lock ? <StatusBadge tone="warning" label="Locked" /> : null}
                    </span>
                  ),
                },
                {
                  key: 'updated_at',
                  label: 'Updated',
                  render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{text(row, 'updated_at')}</span>,
                },
              ]}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No projects"
              body=""
              action={
                <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                  New project
                </button>
              }
            />
          ) : (
            <PaginatedSlice items={rows} pageSize={12}>
              {(pageRows) => (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {pageRows.map((row) => (
                    <Link
                      key={String(row.project_id)}
                      to={`/qrp/projects/${row.project_id}`}
                      className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{text(row, 'name')}</p>
                        <StatusBadge tone={row.is_archived ? 'warning' : 'success'} label={row.is_archived ? 'Archived' : 'Active'} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{text(row, 'owner_username') || 'No owner'} · {String(row.project_type || '').replace(/_/g, ' ')}</p>
                      <p className="mt-3 text-sm tabular-nums text-muted-foreground">
                        {requestByProject.get(String(row.project_id || '')) ?? 0} linked request(s)
                        {row.submission_lock ? ' · submission locked' : ''}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{text(row, 'description') || 'Open hub for members, requests, holds, usage.'}</p>
                    </Link>
                  ))}
                </div>
              )}
            </PaginatedSlice>
          )}
        </QueryBody>
      </Card>
      <RelatedNav
        items={[
          { to: '/qrp/organization', label: 'Organization' },
          { to: '/qrp/approvals', label: 'Review queue' },
          { to: '/qrp/policies', label: 'Policies' },
          { to: '/qrp/quotas', label: 'Quotas' },
        ]}
      />
    </Page>
  )
}
