import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'

import { asList, qre } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ReservationCalendar } from '@/components/data/ReservationCalendar'
import { FilterBar } from '@/components/data/FilterBar'
import { Card, MetricTile, Notice, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatApiError } from '@/lib/apiMessage'
import { formatDateTime } from '@/lib/display'
import { QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

const RESERVATION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Requested' },
  { id: 'active', label: 'Active' },
  { id: 'released', label: 'Released' },
  { id: 'cancelled', label: 'Cancelled' },
] as const

export function ReservationsPage() {
  const client = useQueryClient()
  const { openConfirm, confirmDialog } = useConfirmDialog()
  const [searchParams, setSearchParams] = useSearchParams()
  const projectId = searchParams.get('project_id')?.trim() || ''
  const [filter, setFilter] = useState<(typeof RESERVATION_FILTERS)[number]['id']>('all')
  const [view, setView] = useState<'list' | 'calendar'>('calendar')
  const [conflictsOnly, setConflictsOnly] = useState(() => searchParams.get('conflicts') === '1')
  const [search, setSearch] = useState('')
  const [transitionError, setTransitionError] = useState<{ id: string; message: string } | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const path = useMemo(() => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('state', filter)
    if (projectId) params.set('project_id', projectId)
    const q = params.toString()
    return q ? `/reservations?${q}` : '/reservations'
  }, [filter, projectId])
  const query = useQuery({
    queryKey: ['reservations', filter, projectId],
    queryFn: () => qre<{ items?: Row[]; transitions?: Record<string, string[]>; conflict_count?: number }>(path),
  })
  const move = useMutation({
    mutationFn: ({ id, state }: { id: string; state: string }) =>
      qre(`/reservations/${encodeURIComponent(id)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ state }),
      }),
    onMutate: ({ id }) => {
      setMovingId(id)
      setTransitionError(null)
    },
    onSuccess: () => {
      setMovingId(null)
      void client.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: (err, { id }) => {
      setMovingId(null)
      setTransitionError({ id, message: formatApiError(err) })
    },
  })
  const transitions = query.data?.transitions ?? {}
  const allRows = asList(query.data)
  const conflictCount =
    typeof query.data?.conflict_count === 'number'
      ? query.data.conflict_count
      : allRows.filter((r) => r.has_conflict).length
  const q = search.trim().toLowerCase()
  const searched = q
    ? allRows.filter((row) =>
        ['reservation_id', 'resource_ref', 'purpose', 'project_id', 'state', 'created_by'].some((key) =>
          String(row[key] ?? '')
            .toLowerCase()
            .includes(q),
        ),
      )
    : allRows
  const rows = conflictsOnly ? searched.filter((row) => Boolean(row.has_conflict)) : searched
  const countFor = (state: string) => allRows.filter((r) => String(r.state) === state).length
  const clearProject = () => setSearchParams({}, { replace: true })
  const scheduleDayHref = (dateStr: string) => {
    const params = new URLSearchParams({ date: dateStr })
    if (projectId) params.set('project_id', projectId)
    return `/qrp/scheduling?${params}`
  }
  const showConflictsOnly = () => {
    setConflictsOnly(true)
    setView('list')
    const params = new URLSearchParams(searchParams)
    params.set('conflicts', '1')
    setSearchParams(params, { replace: true })
  }
  const clearConflictsFilter = () => {
    setConflictsOnly(false)
    const params = new URLSearchParams(searchParams)
    params.delete('conflicts')
    setSearchParams(params, { replace: true })
  }
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/reservations' },
        { label: 'Reservation calendar' },
      ]}
      title="Reservations"
      {...opsPageGuidance.reservations}
      actions={
        <span className="flex flex-wrap gap-2">
          <Link to="/qrp/scheduling" className="btn-primary">
            Request a window
          </Link>
          
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      {projectId ? (
        <Notice tone="warning">
          Holds for project <CopyableId value={projectId} keep={12} />{' '}
          <Link className="font-medium text-primary hover:underline" to={`/qrp/projects/${projectId}`}>
            Project hub
          </Link>
          <button type="button" className="btn-ghost ms-2 text-sm" onClick={clearProject}>
            All projects
          </button>
        </Notice>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Requested" value={countFor('requested')} hint="Awaiting activate" tone="warning" />
        <MetricTile label="Active" value={countFor('active')} hint="Hold in force" tone="success" />
        <MetricTile label="Released" value={countFor('released')} hint="Terminal" />
        <MetricTile label="Cancelled" value={countFor('cancelled')} hint="Terminal" tone="critical" />
        <MetricTile label="Conflicts" value={conflictCount} hint="Overlapping holds" tone={conflictCount ? 'critical' : 'neutral'} />
      </div>
      {conflictCount > 0 && (
        <Notice tone="warning">
          <p>
            {conflictCount} overlapping reservation(s) flagged. Overlaps are not auto-cancelled — resolve by releasing or
            cancelling one hold, or adjust windows.
          </p>
          {!conflictsOnly ? (
            <button type="button" className="btn-ghost mt-2 text-sm" onClick={showConflictsOnly}>
              Show overlapping holds
            </button>
          ) : (
            <button type="button" className="btn-ghost mt-2 text-sm" onClick={clearConflictsFilter}>
              Show all holds
            </button>
          )}
        </Notice>
      )}
      {transitionError ? (
        <Notice tone="critical">
          Could not move hold <CopyableId value={transitionError.id} keep={10} />: {transitionError.message}
          <button type="button" className="btn-ghost ms-2 text-sm" onClick={() => setTransitionError(null)}>
            Dismiss
          </button>
        </Notice>
      ) : null}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FilterBar
            options={RESERVATION_FILTERS}
            value={filter}
            onChange={(id) => setFilter(id as (typeof RESERVATION_FILTERS)[number]['id'])}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Resource, purpose, project…"
            defaultId="all"
          />
          <div className="ms-auto flex gap-1 rounded-lg border border-border p-0.5" role="tablist" aria-label="Reservation view">
            <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'chip-active' : 'btn-ghost'} onClick={() => setView('list')}>
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'calendar'}
              className={view === 'calendar' ? 'chip-active' : 'btn-ghost'}
              onClick={() => setView('calendar')}
            >
              Calendar
            </button>
          </div>
        </div>
        <QueryBody query={query}>
          {view === 'calendar' ? (
            <ReservationCalendar rows={rows} scheduleDayHref={scheduleDayHref} />
          ) : (
            <Table
              rows={rows}
              emptyTitle="No reservations"
              emptyBody="Request an organization hold window on an approved project asset from Scheduling."
              columns={[
                {
                  key: 'reservation_id',
                  label: 'Reservation',
                  render: (row) => <CopyableId value={String(row.reservation_id || '')} keep={10} />,
                },
                { key: 'resource_ref', label: 'Resource', sortable: true },
                {
                  key: 'project_id',
                  label: 'Project',
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
                  key: 'window_start',
                  label: 'Start',
                  sortable: true,
                  render: (row) => formatDateTime(row.window_start),
                },
                {
                  key: 'window_end',
                  label: 'End',
                  sortable: true,
                  render: (row) => formatDateTime(row.window_end),
                },
                {
                  key: 'state',
                  label: 'State',
                  render: (row) => <StatusBadge tone={stateTone(String(row.state || ''))} label={stateLabel(String(row.state || 'requested'))} />,
                },
                {
                  key: 'has_conflict',
                  label: 'Conflict',
                  render: (row) =>
                    row.has_conflict ? <StatusBadge tone="critical" label="Overlap" /> : <span className="text-muted-foreground">—</span>,
                },
                { key: 'purpose', label: 'Purpose' },
                {
                  key: 'move',
                  label: 'Move',
                  render: (row) => (
                    <span className="flex flex-wrap gap-2">
                      {(transitions[String(row.state)] ?? []).map((state) => (
                        <button
                          key={state}
                          type="button"
                          className="btn-ghost"
                          disabled={movingId === String(row.reservation_id)}
                          onClick={() => {
                            const id = String(row.reservation_id)
                            openConfirm({
                              title: 'Change hold state',
                              body: `Move hold ${shortId(id, 10)} to ${stateLabel(state)}?`,
                              confirmLabel: stateLabel(state),
                              onConfirm: () => move.mutate({ id, state }),
                            })
                          }}
                        >
                          {movingId === String(row.reservation_id) ? '…' : stateLabel(state)}
                        </button>
                      ))}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </QueryBody>
      </Card>
      <RelatedNav
        items={[
          { to: '/qrp/scheduling', label: 'Scheduling' },
          { to: '/qrp/projects', label: 'Projects' },
          { to: '/qrp/quotas', label: 'Quotas' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
      {confirmDialog}
    </Page>
  )
}
