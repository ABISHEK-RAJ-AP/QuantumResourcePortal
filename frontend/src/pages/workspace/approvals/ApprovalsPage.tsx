import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, EmptyState, MetricTile, Notice, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import {
  APPROVAL_FILTERS,
  approvalAgeLabel,
  approvalsPath,
  type ApprovalRow,
} from '@/pages/workspace/approvals/approval-shared'

export function ApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projectId = searchParams.get('project_id')?.trim() || ''
  const filterParam = searchParams.get('filter')
  const scopeParam = searchParams.get('scope')
  const initialFilter = scopeParam === 'mine'
    ? 'mine'
    : APPROVAL_FILTERS.some((f) => f.id === filterParam)
      ? (filterParam as (typeof APPROVAL_FILTERS)[number]['id'])
      : 'queue'
  const [filter, setFilter] = useState<(typeof APPROVAL_FILTERS)[number]['id']>(initialFilter)
  const [search, setSearch] = useState('')
  const setApprovalFilter = (id: (typeof APPROVAL_FILTERS)[number]['id']) => {
    setFilter(id)
    const params = new URLSearchParams()
    if (projectId) params.set('project_id', projectId)
    if (id === 'mine') {
      params.set('scope', 'mine')
      params.delete('filter')
    } else if (id !== 'queue') {
      params.set('filter', id)
      params.delete('scope')
    } else {
      params.delete('filter')
      params.delete('scope')
    }
    setSearchParams(params, { replace: true })
  }
  const clearProjectFilter = () => {
    const params = new URLSearchParams()
    if (filter !== 'queue') params.set('filter', filter)
    setSearchParams(params, { replace: true })
  }
  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<ApprovalRow>('/governance/summary'),
  })
  const query = useQuery({
    queryKey: ['approvals', filter, projectId],
    queryFn: async () => asList(await qre<unknown>(approvalsPath(filter, projectId || undefined))),
  })
  const counts = (summary.data?.counts as ApprovalRow | undefined) ?? {}
  const rows = (query.data ?? []).filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['workload_id', 'project_id', 'created_by', 'governance_state'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const stageChart = useMemo(
    () =>
      [
        { name: 'Queue', value: Number(summary.data?.queue ?? 0), fill: 'var(--chart-1)' },
        { name: 'In review', value: Number(counts.in_review ?? 0), fill: 'var(--chart-2)' },
        { name: 'Approved', value: Number(counts.approved ?? 0), fill: 'var(--chart-4)' },
        { name: 'Rejected', value: Number(counts.rejected ?? 0), fill: 'var(--chart-5)' },
        { name: 'Withdrawn', value: Number(counts.withdrawn ?? 0), fill: 'var(--chart-3)' },
      ].filter((d) => d.value > 0 || d.name === 'Queue'),
    [summary.data?.queue, counts],
  )
  const nextRow = rows[0]
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp' },
        { label: 'Review queue', to: '/qrp/approvals' },
      ]}
      title="Review Queue"
      {...opsPageGuidance.approvals}
      actions={
        nextRow?.workload_id ? (
          <Link className="btn-primary" to={`/qrp/approvals/${nextRow.workload_id}`}>
            Open {shortId(String(nextRow.workload_id), 8)}
          </Link>
        ) : (
          <Link className="btn-primary" to="/qrp/projects">
            New project
          </Link>
        )
      }
      updatedAt={query.dataUpdatedAt || summary.dataUpdatedAt}
    >
      {projectId ? (
        <Notice tone="warning">
          <span className="font-medium text-foreground">Research project filter</span>
          <p className="mt-1">
            Organization queue scoped to project{' '}
            <CopyableId value={projectId} keep={12} />{' '}
            <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${projectId}`}>
              Open project hub
            </Link>
            <button type="button" className="btn-ghost ms-2 text-sm" onClick={clearProjectFilter}>
              Clear filter
            </button>
          </p>
        </Notice>
      ) : null}
      <KpiStrip className="xl:grid-cols-5" aria-label="Filter queue by status">
        <MetricTile label="Needs review" value={summary.data?.queue} tone="primary" onClick={() => setApprovalFilter('queue')} />
        <MetricTile label="In review" value={counts.in_review} tone="warning" onClick={() => setApprovalFilter('in_review')} />
        <MetricTile label="Approved" value={counts.approved} tone="success" onClick={() => setApprovalFilter('approved')} />
        <MetricTile label="Rejected" value={counts.rejected} tone="critical" onClick={() => setApprovalFilter('rejected')} />
        <MetricTile label="Mine" value={filter === 'mine' ? rows.length : '→'} onClick={() => setApprovalFilter('mine')} />
      </KpiStrip>
      {!summary.isPending && !summary.isError && stageChart.some((d) => d.value > 0) ? (
        <ChartPanel title="Stages" empty={false}>
          {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <BarChart data={stageChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stageChart.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      ) : null}
      <Card>
        <FilterBar
          options={APPROVAL_FILTERS}
          value={filter}
          onChange={(id) => setApprovalFilter(id as (typeof APPROVAL_FILTERS)[number]['id'])}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search workload, project, requester…"
          defaultId="queue"
        />
        <QueryBody query={query}>
          {rows.length === 0 ? (
            <EmptyState
              title="No approvals"
              body={
                search.trim()
                  ? 'No rows match search.'
                  : 'Create a research project, submit a workload, and it appears here for your organization reviewers.'
              }
              action={
                search.trim() ? (
                  <button type="button" className="btn-ghost" onClick={() => setSearch('')}>
                    Clear search
                  </button>
                ) : (
                  <Link className="btn-primary" to="/qrp/projects">
                    Open projects
                  </Link>
                )
              }
            />
          ) : (
            <Table
              rows={rows}
              columns={[
                {
                  key: 'workload_id',
                  label: 'Request',
                  render: (row) => (
                    <span className="flex flex-col gap-0.5">
                      <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                        {shortId(String(row.workload_id || ''), 14)}
                      </Link>
                      <CopyableId value={String(row.workload_id || '')} />
                    </span>
                  ),
                },
                {
                  key: 'governance_state',
                  label: 'Stage / state',
                  sortable: true,
                  render: (row) => (
                    <StatusBadge tone={stateTone(String(row.governance_state || ''))} label={stateLabel(String(row.governance_state || 'unknown'))} />
                  ),
                },
                { key: 'created_by', label: 'Requester', sortable: true },
                {
                  key: 'project_id',
                  label: 'Project',
                  sortable: true,
                  render: (row) =>
                    row.project_id ? (
                      <Link className="hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        {shortId(String(row.project_id), 10)}
                      </Link>
                    ) : (
                      '—'
                    ),
                },
                {
                  key: 'created_at',
                  label: 'Submitted',
                  sortable: true,
                  render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{text(row, 'created_at')}</span>,
                },
                {
                  key: 'age',
                  label: 'Age',
                  sortable: true,
                  align: 'right',
                  render: (row) => (
                    <span className="tabular-nums text-muted-foreground">{approvalAgeLabel(row)}</span>
                  ),
                },

                {
                  key: 'open',
                  label: 'Action',
                  render: (row) => (
                    <Link className="text-sm font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                      Open review
                    </Link>
                  ),
                },
              ]}
            />
          )}
        </QueryBody>
      </Card>
      <RelatedNav
        items={[
          { to: '/qrp/organization', label: 'Organization' },
          { to: '/qrp/projects', label: 'Projects' },
          { to: '/qrp/policies', label: 'Policies' },
          { to: '/qrp/reservations', label: 'Reservations' },
          { to: '/qrp/approvals/history', label: 'Approval history' },
        ]}
      />
    </Page>
  )
}
