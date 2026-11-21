import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ChartPanel } from '@/components/data/ChartPanel'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { BackendsPage } from '@/pages/workspace/inventory/BackendsPage'
import { PoolsPage } from '@/pages/workspace/inventory/PoolsPage'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

const INVENTORY_EXEC = [
  { id: 'all', label: 'All classes' },
  { id: 'simulated', label: 'Simulated' },
  { id: 'hardware', label: 'Hardware' },
] as const

const INVENTORY_LIFE = [
  { id: 'all', label: 'All lifecycle' },
  { id: 'registered', label: 'Registered' },
  { id: 'active', label: 'Active' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'retired', label: 'Retired' },
] as const

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab =
    searchParams.get('tab') === 'pools' ? 'pools' : searchParams.get('tab') === 'backends' ? 'backends' : 'catalogue'
  const [exec, setExec] = useState<(typeof INVENTORY_EXEC)[number]['id']>('all')
  const [life, setLife] = useState<(typeof INVENTORY_LIFE)[number]['id']>('all')
  const [search, setSearch] = useState('')
  const params = new URLSearchParams()
  if (exec !== 'all') params.set('execution_class', exec)
  if (life !== 'all') params.set('lifecycle_state', life)
  const qs = params.toString()
  const allQuery = useQuery({
    queryKey: ['assets-all'],
    queryFn: async () => asList(await qre<unknown>('/inventory/assets')),
  })
  const query = useQuery({
    queryKey: ['assets', exec, life],
    queryFn: async () => asList(await qre<unknown>(`/inventory/assets${qs ? `?${qs}` : ''}`)),
  })
  const all = allQuery.data ?? []
  const rows = (query.data ?? []).filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['asset_id', 'asset_class', 'provider_id', 'lifecycle_state', 'execution_class'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const active = all.filter((row) => String(row.lifecycle_state || '') === 'active').length
  const maintenance = all.filter((row) => ['maintenance', 'suspended'].includes(String(row.lifecycle_state || ''))).length
  const providers = new Set(all.map((row) => String(row.provider_id || '')).filter(Boolean)).size
  const lifeChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.lifecycle_state || 'unknown')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name: stateLabel(name),
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [all])
  const execChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of all) {
      const key = String(row.execution_class || 'unknown')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [all])
  const catalogueBody = (
    <>
      <KpiStrip className="sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile compact label="Registered" value={allQuery.isError ? '—' : all.length} />
        <MetricTile compact label="Active" value={allQuery.isError ? '—' : active} tone="success" />
        <MetricTile compact label="Service / hold" value={allQuery.isError ? '—' : maintenance} tone={maintenance ? 'warning' : 'neutral'} />
        <MetricTile compact label="Providers" value={allQuery.isError ? '—' : providers} />
      </KpiStrip>
      {!allQuery.isPending && all.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {lifeChart.length > 0 ? (
            <ChartPanel title="Lifecycle mix" empty={false}>
              {(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <PieChart>
                    <Pie data={lifeChart} dataKey="value" nameKey="name" innerRadius={Math.max(28, h * 0.28)} outerRadius={Math.max(48, h * 0.42)} paddingAngle={2}>
                      {lifeChart.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>
          ) : null}
          {execChart.length > 0 ? (
            <ChartPanel title="By execution class" empty={false}>
              {(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={execChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartPanel>
          ) : null}
        </div>
      ) : null}
      <Card>
        <FilterBar
          options={INVENTORY_EXEC}
          value={exec}
          onChange={(id) => setExec(id as (typeof INVENTORY_EXEC)[number]['id'])}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search assets…"
          defaultId="all"
          trailing={
            <span className="flex flex-wrap gap-2">
              {INVENTORY_LIFE.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={life === opt.id ? 'chip-active' : 'btn-ghost'}
                  aria-pressed={life === opt.id}
                  onClick={() => setLife(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </span>
          }
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No assets in catalogue"
            emptyBody="Register organization assets or bulk-import — ties to platform providers and pools."
            columns={[
              {
                key: 'asset_id',
                label: 'Asset',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/inventory/${row.asset_id}`}>
                      {shortId(String(row.asset_id || ''), 12)}
                    </Link>
                    <CopyableId value={String(row.asset_id || '')} />
                  </span>
                ),
              },
              { key: 'asset_class', label: 'Class', sortable: true },
              { key: 'execution_class', label: 'Execution', sortable: true },
              {
                key: 'lifecycle_state',
                label: 'Lifecycle',
                sortable: true,
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.lifecycle_state || ''))} label={stateLabel(String(row.lifecycle_state || 'registered'))} />
                ),
              },
              {
                key: 'provider_id',
                label: 'Provider',
                render: (row) =>
                  row.provider_id ? (
                    <Link className="hover:underline" to={`/qrp/providers/${row.provider_id}`}>
                      {text(row, 'provider_id')}
                    </Link>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        </QueryBody>
      </Card>
    </>
  )
  return (
    <Page
      crumbs={[
        { label: 'Resources', to: '/qrp/inventory' },
        { label: tab === 'pools' ? 'Pools' : tab === 'backends' ? 'Backends' : 'Catalogue' },
      ]}
      title={tab === 'pools' ? 'Resource pools' : tab === 'backends' ? 'Backends' : 'Inventory catalogue'}
      {...opsPageGuidance.inventory}
      actions={
        tab === 'catalogue' ? (
          <span className="flex flex-wrap gap-2">
            <Link className="btn-primary" to="/qrp/inventory/register">
              Register asset
            </Link>
            <Link className="btn-ghost" to="/qrp/inventory/register?mode=bulk&step=method">
              Import CSV
            </Link>
          </span>
        ) : null
      }
      updatedAt={allQuery.dataUpdatedAt || query.dataUpdatedAt}
    >
      <RecordWorkspace
        layout="hub"
        tabs={[
          { id: 'catalogue', label: 'Catalogue', count: allQuery.isError ? undefined : all.length },
          { id: 'pools', label: 'Pools' },
          { id: 'backends', label: 'Backends' },
        ]}
        activeTab={tab}
        onTabChange={(id) => {
          if (id === 'catalogue') setSearchParams({}, { replace: true })
          else setSearchParams({ tab: id }, { replace: true })
        }}
      >
        {tab === 'catalogue' ? catalogueBody : null}
        {tab === 'pools' ? <PoolsPage embedded /> : null}
        {tab === 'backends' ? <BackendsPage embedded /> : null}
      </RecordWorkspace>
      {tab === 'catalogue' ? (
        <RelatedNav
          items={[
            { to: '/qrp/organization', label: 'Organization' },
            { to: '/qrp/providers', label: 'Providers' },
            { to: '/qrp/backends', label: 'Backends hub' },
            { to: '/qrp/pools', label: 'Pools' },
          ]}
        />
      ) : tab === 'pools' ? (
        <RelatedNav
          items={[
            { to: '/qrp/inventory', label: 'Catalogue' },
            { to: '/qrp/scheduling', label: 'Scheduling' },
            { to: '/qrp/organization', label: 'Organization' },
          ]}
        />
      ) : tab === 'backends' ? (
        <RelatedNav
          items={[
            { to: '/qrp/inventory', label: 'Catalogue' },
            { to: '/qrp/jobs?tab=queues', label: 'Queues' },
            { to: '/qrp/organization', label: 'Organization' },
          ]}
        />
      ) : null}
    </Page>
  )
}
