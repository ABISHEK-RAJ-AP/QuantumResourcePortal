import { useQuery } from '@tanstack/react-query'

import { asList, qre, text } from '@/api/qre'
import { DataTable } from '@/components/data/DataTable'
import { Card, MetricTile, Notice, Page, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { QueryBody, shortId } from '@/pages/workspace/shared/helpers'
import { useDemoOperationalPolling } from '@/hooks/useDemoOperationalPolling'
import { formatDateTime } from '@/lib/display'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function ProviderOverview() {
  const pollMs = useDemoOperationalPolling()

  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
    refetchInterval: pollMs,
  })
  const queue = useQuery({
    queryKey: ['approvals-provider-home'],
    queryFn: async () => asList(await qre<unknown>('/approvals?limit=8')),
    refetchInterval: pollMs,
  })
  const assets = useQuery({
    queryKey: ['inventory-home-count'],
    queryFn: async () => asList(await qre<unknown>('/inventory/assets?limit=50')),
    retry: false,
  })
  const centre = useQuery({
    queryKey: ['operations-centre'],
    queryFn: () => qre<Row>('/operations/centre'),
    retry: false,
    refetchInterval: pollMs,
  })

  const fleet = (centre.data?.fleet as Row | undefined) ?? {}
  const queueRows = queue.data ?? []
  const pending = queueRows.filter((r) => ['submitted_for_review', 'in_review'].includes(String(r.state)))
  const assetsRows = assets.data ?? []
  const online = assetsRows.filter((a) => String(a.lifecycle_state ?? a.status) === 'active').length

  return (
    <Page
      crumbs={[{ label: 'Workspace', to: '/qrp' }, { label: 'Home' }]}
      title="Provider operations"
      {...opsPageGuidance.providerOverview}
      updatedAt={summary.dataUpdatedAt || queue.dataUpdatedAt}
    >
      <Notice tone="info">
        Availability confirmation workflows are limited to data shown by the API — actions appear only when backend
        endpoints support provider decisions.
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Assignments queue" value={queue.isError ? '—' : pending.length} to="/qrp/approvals" />
        <MetricTile label="Resources online" value={assets.isError ? '—' : `${online}/${assetsRows.length || '—'}`} to="/qrp/inventory" />
        <MetricTile
          label="Fleet online"
          value={centre.isError ? '—' : `${fleet.online ?? '—'}/${fleet.total ?? '—'}`}
          to="/qrp/inventory"
        />
        <MetricTile label="In review" value={summary.isError ? '—' : Number(summary.data?.queue ?? 0)} />
      </div>

      <Card>
        <p className="type-section-heading mb-3">Requests awaiting coordination</p>
        <QueryBody
          query={queue}
          empty={pending.length === 0}
          emptyTitle="No pending assignments"
          emptyBody="Forwarded requests will appear when governance routes work to your provider scope."
        >
          <DataTable
            columns={[
              {
                key: 'workload_id',
                label: 'Request',
                align: 'mono',
                render: (row) => shortId(String(row.workload_id ?? row.id ?? '')),
              },
              { key: 'purpose', label: 'Purpose' },
              {
                key: 'state',
                label: 'Status',
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.state))} label={stateLabel(String(row.state))} />
                ),
              },
              { key: 'updated_at', label: 'Updated', render: (row) => formatDateTime(text(row, 'updated_at')) },
            ]}
            rows={pending}
            paginate={false}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}