import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, qreDownload } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Notice, Page, RelatedNav } from '@/components/layout/Page'
import { formatDateTime, formatEnum, formatRole } from '@/lib/display'
import { message, QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projectScope = searchParams.get('project_id')?.trim() || ''
  const [search, setSearch] = useState('')
  const [prefix, setPrefix] = useState('all')
  const prefixOptions = [
    { id: 'all', label: 'All actions' },
    { id: 'approval', label: 'approval*' },
    { id: 'inventory', label: 'inventory*' },
    { id: 'quota', label: 'quota*' },
    { id: 'dispatch', label: 'dispatch*' },
    { id: 'user', label: 'user*' },
    { id: 'alert', label: 'alert*' },
  ]
  const path =
    prefix === 'all'
      ? '/governance/audit-events?limit=100'
      : `/governance/audit-events?limit=100&action_prefix=${encodeURIComponent(prefix)}`
  const query = useQuery({
    queryKey: ['audit', prefix],
    queryFn: async () => asList(await qre<unknown>(path)),
  })
  const exportCsv = useMutation({
    mutationFn: () => {
      const exportPath =
        prefix === 'all'
          ? '/governance/audit-events/export?limit=500'
          : `/governance/audit-events/export?limit=500&action_prefix=${encodeURIComponent(prefix)}`
      return qreDownload(exportPath, `audit-events-${new Date().toISOString().slice(0, 10)}.csv`)
    },
  })
  const all = query.data ?? []
  const rows = all.filter((row) => {
    if (projectScope) {
      const tid = String(row.target_id ?? '')
      const pid = String(row.project_id ?? '')
      const matchesProject =
        tid === projectScope || pid === projectScope || tid.includes(projectScope) || pid.includes(projectScope)
      if (!matchesProject) return false
    }
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['actor', 'action', 'target_id', 'target_type', 'role'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const actors = new Set(all.map((row) => String(row.actor || '')).filter(Boolean)).size
  const actionChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const action = String(row.action || 'unknown')
      const family = action.includes('.') ? action.split('.')[0]! : action
      counts.set(family, (counts.get(family) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [all])
  const clearProjectScope = () => setSearchParams({}, { replace: true })
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/audit' },
        { label: 'Audit trail' },
      ]}
      title="Audit Trail"
      {...opsPageGuidance.audit}
      actions={
        <span className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
            {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
          </button>
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      {exportCsv.error && <Notice>{message(exportCsv.error)}</Notice>}
      {projectScope ? (
        <Notice tone="warning">
          Client filter on sample for project <CopyableId value={projectScope} keep={12} /> — export is still organization-wide.{' '}
          <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${projectScope}`}>
            Project hub
          </Link>
          <button type="button" className="btn-ghost ms-2 text-sm" onClick={clearProjectScope}>
            Clear
          </button>
        </Notice>
      ) : null}
      <KpiStrip>
        <MetricTile label="Events (sample)" value={query.isError ? '—' : (projectScope ? rows.length : all.length)} hint="Limit 100 / filter" />
        <MetricTile label="Distinct actors" value={query.isError ? '—' : actors} hint="In current sample" />
        <MetricTile label="Action families" value={query.isError ? '—' : actionChart.length} hint="Prefix before '.'" />
        <MetricTile label="Filter" value={prefix === 'all' ? 'all' : `${prefix}*`} hint="action_prefix" />
      </KpiStrip>
      {actionChart.length > 0 ? (
        <ChartPanel title="Action families in sample" empty={false}>
          {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <BarChart data={actionChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--chart-4)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      ) : null}
      <Card>
        <FilterBar
          options={prefixOptions}
          value={prefix}
          onChange={setPrefix}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search actor, action, target…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No audit events"
            emptyBody="Organization governance actions append here as members work approvals, inventory, and access."
            columns={[
              {
                key: 'timestamp',
                label: 'When',
                render: (row) => <span className="text-sm tabular-nums">{formatDateTime(row.timestamp)}</span>,
              },
              { key: 'actor', label: 'Actor' },
              { key: 'role', label: 'Role', render: (row) => formatRole(String(row.role ?? '')) },
              { key: 'action', label: 'Action', render: (row) => formatEnum(String(row.action ?? '')) },
              { key: 'target_type', label: 'Type', render: (row) => formatEnum(String(row.target_type ?? '')) },
              {
                key: 'target_id',
                label: 'Target',
                render: (row) => (row.target_id ? <CopyableId value={String(row.target_id)} /> : '—'),
              },
            ]}
          />
        </QueryBody>
      </Card>
      <RelatedNav
        items={[
          { to: '/qrp/organization', label: 'Organization' },
          { to: '/qrp/settings', label: 'Settings' },
          { to: '/qrp/approvals/history', label: 'Approval history' },
          { to: '/qrp/admin/users', label: 'People & access' },
        ]}
      />
    </Page>
  )
}
