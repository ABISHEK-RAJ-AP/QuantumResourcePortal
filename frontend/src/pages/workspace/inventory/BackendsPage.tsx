import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { FilterBar } from '@/components/data/FilterBar'
import { KpiStrip } from '@/components/data/KpiStrip'
import { Card, MetricTile, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function BackendsPage({ embedded = false }: { embedded?: boolean }) {
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('all')
  const query = useQuery({
    queryKey: ['backends'],
    queryFn: () => qre<unknown>('/backends'),
  })
  const queues = useQuery({
    queryKey: ['queues-backends'],
    queryFn: () => qre<unknown>('/queues'),
    retry: false,
  })
  const all = asList(query.data)
  const queueById = useMemo(() => {
    const map = new Map<string, Row>()
    for (const row of asList(queues.data)) map.set(String(row.backend_id || ''), row)
    return map
  }, [queues.data])
  const providers = Array.from(new Set(all.map((row) => String(row.provider_id || '')).filter(Boolean))).sort()
  const providerOptions = [{ id: 'all', label: 'All providers' }, ...providers.map((id) => ({ id, label: id }))]
  const rows = all.filter((row) => {
    if (provider !== 'all' && String(row.provider_id || '') !== provider) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return ['backend_name', 'backend_id', 'provider_id', 'operational_status', 'qpu_modality'].some((key) =>
      String(row[key] ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
  const online = all.filter((row) => String(row.operational_status || '').toUpperCase() === 'ONLINE').length
  const qubitTotal = all.reduce((sum, row) => sum + (Number(row.qubit_count) || 0), 0)
  const pendingTotal = asList(queues.data).reduce((sum, row) => sum + (Number(row.pending_jobs) || 0), 0)
  const body = (
    <>
      <KpiStrip>
        <MetricTile label="Catalogue" value={query.isError ? '—' : all.length} hint={`${providers.length} providers`} />
        <MetricTile label="Online" value={query.isError ? '—' : online} hint="Catalogue ONLINE" tone="success" />
        <MetricTile label="Qubits (sum)" value={query.isError ? '—' : qubitTotal} hint="Catalogue qubit_count" />
        <MetricTile
          label="Pending (queues)"
          value={queues.isError ? '—' : pendingTotal}
          hint="From telemetry samples"
          tone={pendingTotal ? 'warning' : 'neutral'}
        /></KpiStrip>
      <Card>
        <FilterBar
          options={providerOptions}
          value={provider}
          onChange={setProvider}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search backends…"
          defaultId="all"
        />
        <QueryBody query={query}>
          <Table
            rows={rows}
            emptyTitle="No backends"
            emptyBody="Platform catalogue empty for this filter — backends are org-visible on the shared fabric."
            columns={[
              {
                key: 'backend_name',
                label: 'Backend',
                render: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <Link className="font-medium text-primary hover:underline" to={`/qrp/backends/${row.backend_id}`}>
                      {text(row, 'backend_name')}
                    </Link>
                    <CopyableId value={String(row.backend_id || '')} />
                  </span>
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
              { key: 'qubit_count', label: 'Qubits', sortable: true },
              { key: 'qpu_modality', label: 'Modality' },
              {
                key: 'pending',
                label: 'Pending',
                render: (row) => {
                  const q = queueById.get(String(row.backend_id || ''))
                  if (!q) return <span className="text-muted-foreground">—</span>
                  return <span className="tabular-nums">{String(q.pending_jobs ?? '—')}</span>
                },
              },
              {
                key: 'queue_condition',
                label: 'Queue',
                render: (row) => {
                  const q = queueById.get(String(row.backend_id || ''))
                  if (!q) return <span className="text-muted-foreground">—</span>
                  return (
                    <StatusBadge
                      tone={stateTone(String(q.queue_condition || '').toLowerCase())}
                      label={stateLabel(String(q.queue_condition || 'unknown'))}
                    />
                  )
                },
              },
              {
                key: 'operational_status',
                label: 'Catalogue status',
                render: (row) => (
                  <StatusBadge
                    tone={stateTone(String(row.operational_status || '').toLowerCase())}
                    label={stateLabel(String(row.operational_status || 'unknown'))}
                  />
                ),
              },
            ]}
          />
        </QueryBody>
      </Card>
    </>
  )
  if (embedded) return body
  return (
    <Page
      crumbs={[{ label: 'Resources', to: '/qrp/inventory' }, { label: 'Backends' }]}
      title="Backends"
      {...opsPageGuidance.backends}
      updatedAt={query.dataUpdatedAt}
    >
      {body}
      <RelatedNav
        items={[
          { to: '/qrp/inventory', label: 'Inventory' },
          { to: '/qrp/jobs?tab=queues', label: 'Queues' },
          { to: '/qrp/support', label: 'Alerts' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
