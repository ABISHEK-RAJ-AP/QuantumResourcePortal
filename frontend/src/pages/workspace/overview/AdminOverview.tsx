import { useMemo } from 'react'
import { Link } from 'react-router'
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

export function AdminOverview() {
  const pollMs = useDemoOperationalPolling()

  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
    refetchInterval: pollMs,
  })
  const queue = useQuery({
    queryKey: ['approvals-queue-home'],
    queryFn: async () => asList(await qre<unknown>('/approvals?limit=12')),
    refetchInterval: pollMs,
  })
  const attempts = useQuery({
    queryKey: ['dispatch-attempts-home'],
    queryFn: async () => asList(await qre<unknown>('/dispatch-attempts')),
    retry: false,
    refetchInterval: pollMs,
  })
  const activity = useQuery({
    queryKey: ['governance-activity-home'],
    queryFn: async () => asList(await qre<unknown>('/governance/activity?limit=8')),
    retry: false,
  })
  const alerts = useQuery({
    queryKey: ['alerts-summary-home'],
    queryFn: () => qre<Row>('/alerts/summary'),
    retry: false,
  })

  const queueCount = Number(summary.data?.queue ?? 0)
  const queueRows = queue.data ?? []
  const unresolved = (attempts.data ?? []).filter((row) => {
    const state = String(row.dispatch_state || '')
    return state === 'dispatch_unresolved' || state === 'dispatch_authorized'
  })
  const exceptionCount = unresolved.length + Number(alerts.data?.active ?? 0)

  const workQueue = useMemo(
    () =>
      queueRows.filter((r) =>
        ['submitted_for_review', 'in_review', 'changes_requested'].includes(String(r.state)),
      ),
    [queueRows],
  )

  return (
    <Page
      crumbs={[{ label: 'Workspace', to: '/qrp' }, { label: 'Home' }]}
      title="Governance operations"
      {...opsPageGuidance.adminOverview}
      updatedAt={summary.dataUpdatedAt || queue.dataUpdatedAt}
      actions={
        <Link to="/qrp/approvals" className="btn-primary">
          Review queue
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Pending review"
          value={summary.isError ? '—' : queueCount}
          hint="Requires decision"
          to="/qrp/approvals"
          tone={queueCount > 0 ? 'warning' : 'neutral'}
        />
        <MetricTile
          label="Reconciliation"
          value={attempts.isError ? '—' : unresolved.length}
          hint="Dispatch attempts"
          to="/qrp/reconciliation"
          tone={unresolved.length > 0 ? 'critical' : 'neutral'}
        />
        <MetricTile
          label="Active alerts"
          value={alerts.isError ? '—' : Number(alerts.data?.active ?? 0)}
          to="/qrp/incidents"
          tone={Number(alerts.data?.active ?? 0) > 0 ? 'warning' : 'neutral'}
        />
        <MetricTile
          label="Exceptions"
          value={exceptionCount}
          hint="Alerts + dispatch backlog"
          to="/qrp/reconciliation"
          tone={exceptionCount > 0 ? 'critical' : 'neutral'}
        />
      </div>

      {exceptionCount > 0 ? (
        <Notice tone="warning">
          {unresolved.length > 0 ? `${unresolved.length} dispatch attempt(s) need reconciliation. ` : null}
          {Number(alerts.data?.active ?? 0) > 0 ? `${alerts.data?.active} active alert(s).` : null}
        </Notice>
      ) : null}

      <Card>
        <p className="type-section-heading mb-3">Governance work queue</p>
        <QueryBody
          query={queue}
          empty={workQueue.length === 0}
          emptyTitle="Queue is clear"
          emptyBody="New submissions will appear here for review."
        >
          <DataTable
            columns={[
              {
                key: 'workload_id',
                label: 'Request',
                align: 'mono',
                render: (row) => shortId(String(row.workload_id ?? row.id ?? '')),
              },
              { key: 'submitter', label: 'Requester', render: (row) => text(row, 'submitter_id') },
              {
                key: 'state',
                label: 'Status',
                render: (row) => (
                  <StatusBadge tone={stateTone(String(row.state))} label={stateLabel(String(row.state))} />
                ),
              },
              {
                key: 'updated_at',
                label: 'Updated',
                render: (row) => formatDateTime(text(row, 'updated_at')),
              },
            ]}
            rows={workQueue}
            paginate={false}
          />
        </QueryBody>
      </Card>

      <Card>
        <p className="type-section-heading mb-3">Recent governance activity</p>
        <QueryBody query={activity} empty={(activity.data?.length ?? 0) === 0} emptyTitle="No recent activity">
          <DataTable
            columns={[
              { key: 'event_type', label: 'Event' },
              { key: 'actor', label: 'Actor', render: (r) => text(r, 'actor_id') },
              { key: 'recorded_at', label: 'When', render: (r) => formatDateTime(text(r, 'recorded_at')) },
            ]}
            rows={activity.data ?? []}
            paginate={false}
          />
        </QueryBody>
      </Card>
    </Page>
  )
}