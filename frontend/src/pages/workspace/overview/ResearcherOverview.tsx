import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { asList, qre, text } from '@/api/qre'
import { useAuth } from '@/auth/hooks'
import { DataTable } from '@/components/data/DataTable'
import { Card, MetricTile, Page, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { QueryBody, shortId } from '@/pages/workspace/shared/helpers'
import { useDemoOperationalPolling } from '@/hooks/useDemoOperationalPolling'
import { formatDateTime } from '@/lib/display'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function ResearcherOverview() {
  const { user } = useAuth()
  const orgLabel = user?.tenant_name || user?.tenant_code || 'your organization'
  const pollMs = useDemoOperationalPolling()

  const summary = useQuery({
    queryKey: ['governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
    refetchInterval: pollMs,
  })
  const mine = useQuery({
    queryKey: ['approvals-mine-home'],
    queryFn: async () => asList(await qre<unknown>('/approvals?scope=mine&limit=8')),
    retry: false,
    refetchInterval: pollMs,
  })
  const reservations = useQuery({
    queryKey: ['reservations-upcoming-home'],
    queryFn: async () => asList(await qre<unknown>('/reservations?limit=5')),
    retry: false,
  })
  const ledger = useQuery({
    queryKey: ['quota-ledger-home'],
    queryFn: () => qre<Row>('/quotas/ledger'),
    retry: false,
  })

  const counts = (summary.data?.counts as Row | undefined) ?? {}
  const myRows = mine.data ?? []
  const used = Number(ledger.data?.used_shots ?? 0)
  const cap = Number(ledger.data?.daily_shots_cap ?? 0)
  const quotaPct = cap > 0 ? Math.round((used / cap) * 100) : null

  const nextAction = useMemo(() => {
    const priority = ['changes_requested', 'in_review', 'submitted_for_review']
    for (const state of priority) {
      const row = myRows.find((r) => String(r.state) === state)
      if (row) return row
    }
    return myRows[0]
  }, [myRows])

  const pipeline = useMemo(
    () => [
      { label: 'Submitted', value: Number(counts.submitted_for_review ?? 0) },
      { label: 'In review', value: Number(counts.in_review ?? 0) },
      { label: 'Approved', value: Number(counts.approved ?? 0) },
      { label: 'Changes', value: Number(counts.changes_requested ?? 0) },
    ],
    [counts],
  )

  return (
    <Page
      crumbs={[{ label: 'Workspace', to: '/qrp' }, { label: 'Home' }]}
      title="Your research workspace"
      description={opsPageGuidance.researcherHome.description}
      descriptionHelp={`Track requests, reservations, and workloads for ${orgLabel}.`}
      updatedAt={summary.dataUpdatedAt || mine.dataUpdatedAt}
      actions={
        <Link to="/qrp/projects" className="btn-primary">
          New resource request
        </Link>
      }
    >
      {nextAction ? (
        <Card className="border-primary/25 bg-primary/[0.03]">
          <p className="type-caption">Next action</p>
          <p className="type-section-heading mt-1">
            Request {shortId(String(nextAction.workload_id ?? nextAction.id ?? ''))}
          </p>
          <p className="type-body-small mt-1 text-muted-foreground">
            <StatusBadge tone={stateTone(String(nextAction.state))} label={stateLabel(String(nextAction.state))} />
            {nextAction.updated_at ? ` · updated ${formatDateTime(String(nextAction.updated_at))}` : null}
          </p>
          <Link
            to={`/qrp/approvals/${encodeURIComponent(String(nextAction.workload_id ?? nextAction.id))}`}
            className="btn-secondary mt-3"
          >
            View request
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Active workloads"
          value={myRows.filter((r) => !['withdrawn', 'rejected'].includes(String(r.state))).length}
        />
        <MetricTile label="Quota used today" value={quotaPct != null ? `${quotaPct}%` : '—'} to="/qrp/quotas" />
        <MetricTile
          label="Pending requests"
          value={
            mine.isError
              ? '—'
              : myRows.filter((r) =>
                  ['submitted_for_review', 'in_review', 'changes_requested'].includes(String(r.state)),
                ).length
          }
          to="/qrp/approvals?scope=mine"
        />
        <MetricTile label="Reservations" value={reservations.isError ? '—' : (reservations.data?.length ?? 0)} to="/qrp/reservations" />
      </div>

      <Card>
        <p className="type-section-heading mb-3">My workload pipeline</p>
        <div className="flex flex-wrap gap-2">
          {pipeline.map((p) => (
            <span key={p.label} className="chip-active tabular-nums">
              {p.label} · {p.value}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <p className="type-section-heading mb-3">Recent workloads</p>
        <QueryBody
          query={mine}
          empty={myRows.length === 0}
          emptyTitle="No workloads yet"
          emptyBody="Create a project and submit your first request."
        >
          <DataTable
            columns={[
              {
                key: 'workload_id',
                label: 'ID',
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
              {
                key: 'updated_at',
                label: 'Updated',
                render: (row) => formatDateTime(text(row, 'updated_at')),
              },
            ]}
            rows={myRows}
            paginate={false}
          />
        </QueryBody>
      </Card>

      {(reservations.data?.length ?? 0) > 0 ? (
        <Card>
          <p className="type-section-heading mb-3">Upcoming reservations</p>
          <DataTable
            columns={[
              {
                key: 'resource_id',
                label: 'Resource',
                align: 'mono',
                render: (r) => shortId(String(r.resource_id ?? r.backend_id ?? '')),
              },
              { key: 'starts_at', label: 'Starts', render: (r) => formatDateTime(text(r, 'starts_at')) },
              {
                key: 'state',
                label: 'Status',
                render: (r) => <StatusBadge tone={stateTone(String(r.state))} label={stateLabel(String(r.state))} />,
              },
            ]}
            rows={reservations.data ?? []}
            paginate={false}
          />
        </Card>
      ) : null}
    </Page>
  )
}