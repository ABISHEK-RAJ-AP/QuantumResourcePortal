import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { ReservationCalendar } from '@/components/data/ReservationCalendar'
import { KpiStrip } from '@/components/data/KpiStrip'
import {
  Card,
  DetailSkeleton,
  EmptyState,
  MetricTile,
  Notice,
  Page,
  PanelHeader,
  stateLabel,
  stateTone,
} from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { WorkloadSubmitWizard } from '@/components/workflow/WorkloadSubmitWizard'
import { FormField, fieldErrorClass } from '@/components/forms/FormField'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { parseForm } from '@/lib/validation/parseForm'
import { projectMemberSchema } from '@/lib/validation/schemas'
import { cn } from '@/lib/utils'
import {
  scopedApprovalsPath,
  scopedAuditPath,
  scopedQuotasPath,
  scopedReservationsPath,
} from '@/lib/projectScope'
import { CHART_COLORS } from '@/pages/workspace/shared/chart-colors'
import { buttonClass, fieldClass } from '@/pages/workspace/shared/form-classes'
import { message, QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

function MemberForm({ projectId }: { projectId: string }) {
  const client = useQueryClient()
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const add = useMutation({
    mutationFn: () =>
      qre(`/projects/${encodeURIComponent(projectId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ username, role }),
      }),
    onSuccess: () => {
      setUsername('')
      void client.invalidateQueries({ queryKey: ['project-members', projectId] })
    },
  })
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setFieldErrors({})
        const parsed = parseForm(projectMemberSchema, { username, role })
        if (!parsed.ok) {
          setFieldErrors(parsed.fieldErrors)
          return
        }
        add.mutate()
      }}
    >
      <FormField label="Username" htmlFor="member-user" error={fieldErrors.username}>
        <input
          id="member-user"
          className={cn(fieldClass, fieldErrorClass(Boolean(fieldErrors.username)))}
          value={username}
          placeholder="Directory username"
          onChange={(event) => setUsername(event.target.value)}
        />
      </FormField>
      <FormField label="Role" htmlFor="member-role">
        <select id="member-role" className={fieldClass} value={role} onChange={(event) => setRole(event.target.value as 'editor' | 'viewer')}>
          <option value="editor">editor</option>
          <option value="viewer">viewer</option>
        </select>
      </FormField>
      <button type="submit" className={buttonClass} disabled={add.isPending}>
        Add member
      </button>
      {add.error && <p className="w-full text-sm text-critical">{message(add.error)}</p>}
    </form>
  )
}

const PROJECT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'requests', label: 'Requests' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'usage', label: 'Usage' },
  { id: 'activity', label: 'Activity' },
] as const

type ProjectTab = (typeof PROJECT_TABS)[number]['id']

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: ProjectTab = PROJECT_TABS.some((t) => t.id === tabParam) ? (tabParam as ProjectTab) : 'overview'
  const setTab = (id: ProjectTab) => {
    if (id === 'overview') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: id }, { replace: true })
  }

  const [submitOpen, setSubmitOpen] = useState(false)

  const tabCrumb =
    tab === 'members'
      ? 'Members'
      : tab === 'requests'
        ? 'Requests'
        : tab === 'reservations'
          ? 'Holds'
          : tab === 'usage'
            ? 'Usage'
            : tab === 'activity'
              ? 'Activity'
              : null

  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => qre<Row>(`/projects/${encodeURIComponent(projectId)}`),
    enabled: !!projectId,
  })
  const members = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => qre<unknown>(`/projects/${encodeURIComponent(projectId)}/members`),
    enabled: !!projectId,
  })
  const approvals = useQuery({
    queryKey: ['project-approvals', projectId],
    queryFn: async () => asList(await qre<unknown>(`/approvals?project_id=${encodeURIComponent(projectId)}`)),
    enabled: !!projectId,
    retry: false,
  })
  const reservations = useQuery({
    queryKey: ['project-reservations', projectId],
    queryFn: async () => asList(await qre<unknown>(`/reservations?project_id=${encodeURIComponent(projectId)}`)),
    enabled: !!projectId,
    retry: false,
  })
  const quota = useQuery({
    queryKey: ['project-quota', projectId],
    queryFn: () => qre<Row>(`/quotas/ledger?window=today&project_id=${encodeURIComponent(projectId)}`),
    enabled: !!projectId,
    retry: false,
  })
  const activity = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: async () => asList(await qre<unknown>(`/governance/activity?project_id=${encodeURIComponent(projectId)}&limit=30`)),
    enabled: !!projectId,
    retry: false,
  })
  const memberRows = asList(members.data)
  const approvalRows = approvals.data ?? []
  const reservationRows = reservations.data ?? []
  const activityRows = activity.data ?? []
  const openApprovals = approvalRows.filter((r) =>
    ['submitted_for_review', 'in_review', 'changes_requested'].includes(String(r.governance_state || '')),
  ).length
  const approvedCount = approvalRows.filter((r) => String(r.governance_state || '') === 'approved').length
  const activeHolds = reservationRows.filter((r) => ['requested', 'active'].includes(String(r.state || ''))).length
  const locked = Boolean(project.data?.submission_lock)
  const archived = Boolean(project.data?.is_archived)
  const projectName = String(project.data?.name || projectId)
  const requestStateChart = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of approvalRows) {
      const key = stateLabel(String(row.governance_state || 'unknown'))
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [approvalRows])
  const readiness = [
    { ok: !archived, label: 'Project is active (not archived)' },
    { ok: memberRows.length > 0 || members.isError, label: members.isError ? 'Members API unavailable' : 'At least one member listed' },
    { ok: !locked, label: locked ? 'Submission unlocked (currently locked by open review)' : 'Submission unlocked' },
    { ok: !quota.isError, label: quota.isError ? 'Quota ledger reachable' : 'Quota ledger available' },
  ]

  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/projects' },
        { label: 'Projects', to: '/qrp/projects' },
        { label: projectName, to: `/qrp/projects/${projectId}` },
        ...(tabCrumb ? [{ label: tabCrumb }] : []),
      ]}
      title={projectName}
      {...opsPageGuidance.projectDetail}
      actions={
        <span className="flex flex-wrap items-center gap-3">
          <CopyableId value={projectId} keep={14} />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (locked || archived) setTab('requests')
              else setSubmitOpen(true)
            }}
          >
            {locked || archived ? 'View requests' : 'Create resource request'}
          </button>
        </span>
      }
      updatedAt={project.dataUpdatedAt}
    >
      <WorkloadSubmitWizard open={submitOpen} projectId={projectId} onClose={() => setSubmitOpen(false)} />
      {project.isPending ? (
        <DetailSkeleton />
      ) : (
        <>
          <KpiStrip>
            <MetricTile label="Open reviews" value={approvals.isError ? '—' : openApprovals} hint="Needs reviewer action" tone={openApprovals ? 'warning' : 'neutral'} />
            <MetricTile label="Approved" value={approvals.isError ? '—' : approvedCount} hint="Eligible for hold / dispatch path" tone="success" />
            <MetricTile label="Requests" value={approvals.isError ? '—' : approvalRows.length} hint="All linked workloads" />
            <MetricTile label="Active holds" value={reservations.isError ? '—' : activeHolds} hint="Requested or active windows" />
            <MetricTile label="Members" value={members.isError ? '—' : memberRows.length} hint="Directory membership" /></KpiStrip>

          <RecordWorkspace
            tabs={PROJECT_TABS.map((t) => ({
              id: t.id,
              label: t.label,
              count:
                t.id === 'members'
                  ? memberRows.length
                  : t.id === 'requests'
                    ? approvalRows.length
                    : t.id === 'reservations'
                      ? reservationRows.length
                      : t.id === 'activity'
                        ? activityRows.length
                        : undefined,
            }))}
            activeTab={tab}
            onTabChange={(id) => setTab(id as ProjectTab)}
            nextAction={{
              title: locked
                ? 'Finish open review'
                : archived
                  ? 'Project archived'
                  : openApprovals
                    ? 'Open reviews waiting'
                    : 'Create or track requests',
              body: locked
                ? 'Finish the open review first.'
                : archived
                  ? 'Archived — read-only for new requests.'
                  : openApprovals
                    ? `${openApprovals} in review.`
                    : 'Create a request or open Requests.',
              help: locked
                ? 'Submission stays locked until the open review finishes or is withdrawn.'
                : archived
                  ? 'Archived projects cannot accept new requests; existing records remain visible.'
                  : openApprovals
                    ? 'Decide in Review queue before submitting another request for this project.'
                    : 'Submit a scoped request, then track holds and usage from this hub.',
              blockers: [
                ...(archived ? ['Project is archived'] : []),
                ...(locked ? ['Submission lock active'] : []),
                ...(quota.data && quota.data.remaining_shots === 0 ? ['Daily shot remaining is 0'] : []),
              ],
              primary: locked || archived
                ? { label: 'Open Requests', onClick: () => setTab('requests') }
                : { label: 'Create request', onClick: () => setSubmitOpen(true) },
              secondary: { to: scopedApprovalsPath(projectId), label: 'Review Queue' },
            }}
            related={[
              { to: scopedApprovalsPath(projectId), label: 'Review Queue', hint: `${openApprovals} open here` },
              { to: scopedReservationsPath(projectId), label: 'Holds', hint: `${reservationRows.length} on project` },
              { to: '/qrp/scheduling', label: 'Schedule hold', hint: 'Guided window request' },
              { to: scopedQuotasPath(projectId), label: 'Quotas', hint: quota.isError ? 'Unavailable' : 'Project ledger' },
              { to: '/qrp/metering', label: 'Metering', hint: 'Usage samples' },
              { to: '/qrp/inventory', label: 'Catalogue', hint: 'Eligible resources' },
              { to: '/qrp/reconciliation', label: 'Dispatch', hint: 'Attempts / reconcile' },
              { to: scopedAuditPath(projectId), label: 'Audit', hint: 'Filtered sample' },
            ]}
          >
            {tab === 'overview' && (
              <QueryBody query={project}>
                {project.data && (
                  <div className="space-y-4">
                    {locked ? (
                      <Notice tone="warning">
                        Submission locked while a request is under review. Finish or withdraw the open review before creating another —{' '}
                        <button type="button" className="font-medium text-primary hover:underline" onClick={() => setTab('requests')}>
                          open Requests
                        </button>
                        .
                      </Notice>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="space-y-3">
                        <PanelHeader
                          title="Project readiness"
                          tip="Checklist and metadata before you submit new requests."
                        />
                        <ul className="space-y-2 text-sm">
                          {readiness.map((item) => (
                            <li key={item.label} className="flex items-start gap-2">
                              <span className={item.ok ? 'text-success' : 'text-critical'}>{item.ok ? '✓' : '!'}</span>
                              <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                            </li>
                          ))}
                        </ul>
                        <dl className="grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-[11px] font-medium text-muted-foreground">Owner</dt>
                            <dd className="mt-1 font-medium">{text(project.data, 'owner_username')}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-medium text-muted-foreground">Type</dt>
                            <dd className="mt-1">{String(project.data.project_type || '—').replace(/_/g, ' ')}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-[11px] font-medium text-muted-foreground">Description</dt>
                            <dd className="mt-1 text-muted-foreground">{text(project.data, 'description') || '—'}</dd>
                          </div>
                        </dl>
                      </Card>
                      <Card className="space-y-3">
                        <PanelHeader title="Request lifecycle mix" tip="Governance states for workloads scoped to this project." />
                        {requestStateChart.length === 0 ? (
                          <EmptyState title="No requests yet" body="Create a resource request to populate this chart." />
                        ) : (
                          <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={requestStateChart} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>
                                  {requestStateChart.map((d) => (
                                    <Cell key={d.name} fill={d.fill} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </Card>
                    </div>

                    <Card className="space-y-3">
                      <PanelHeader title="What needs attention" tip="Counts link to the matching project tab." />
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('requests')}>
                          <span className="block text-[11px] font-medium text-muted-foreground">Open reviews</span>
                          <span className="text-lg font-semibold tabular-nums">{approvals.isError ? '—' : openApprovals}</span>
                        </button>
                        <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('reservations')}>
                          <span className="block text-[11px] font-medium text-muted-foreground">Active / requested holds</span>
                          <span className="text-lg font-semibold tabular-nums">{reservations.isError ? '—' : activeHolds}</span>
                        </button>
                        <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('usage')}>
                          <span className="block text-[11px] font-medium text-muted-foreground">Shots remaining today</span>
                          <span className="text-lg font-semibold tabular-nums">{quota.isError ? '—' : String(quota.data?.remaining_shots ?? '—')}</span>
                        </button>
                        <button type="button" className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent" onClick={() => setTab('activity')}>
                          <span className="block text-[11px] font-medium text-muted-foreground">Recent decisions</span>
                          <span className="text-lg font-semibold tabular-nums">{activity.isError ? '—' : activityRows.length}</span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                        <button type="button" className="btn-primary" onClick={() => setTab('requests')}>
                          {locked ? 'Review open requests' : 'Create resource request'}
                        </button>
                        <Link className="fs-link text-sm" to="/qrp/scheduling">
                          Request hold window
                        </Link>
                      </div>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="space-y-3">
                        <PanelHeader
                          title="Latest requests"
                          action={
                            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setTab('requests')}>
                              All requests
                            </button>
                          }
                        >
                        <QueryBody query={approvals}>
                          <Table
                            rows={approvalRows.slice(0, 5)}
                            emptyTitle="No requests"
                            emptyBody="Create a resource request to start governance review for this project."
                            columns={[
                              {
                                key: 'workload_id',
                                label: 'Request',
                                render: (row) => (
                                  <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                                    {shortId(String(row.workload_id || ''), 12)}
                                  </Link>
                                ),
                              },
                              {
                                key: 'governance_state',
                                label: 'State',
                                render: (row) => (
                                  <StatusBadge
                                    tone={stateTone(String(row.governance_state || ''))}
                                    label={stateLabel(String(row.governance_state || 'unknown'))}
                                  />
                                ),
                              },
                              { key: 'created_by', label: 'By' },
                            ]}
                          />
                        </QueryBody>
                        </PanelHeader>
                      </Card>
                      <Card className="space-y-3">
                        <PanelHeader
                          title="Holds & quota"
                          action={
                            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setTab('reservations')}>
                              Calendar
                            </button>
                          }
                        >
                        {quota.isError ? (
                          <p className="text-sm text-muted-foreground">Quota ledger unavailable.</p>
                        ) : (
                          <p className="text-sm">
                            Today (UTC): <span className="font-semibold tabular-nums">{String(quota.data?.used_shots ?? '—')}</span> used /{' '}
                            <span className="font-semibold tabular-nums">{String(quota.data?.daily_shots_cap ?? '—')}</span> cap · remaining{' '}
                            <span className="font-semibold tabular-nums">{String(quota.data?.remaining_shots ?? '—')}</span>
                          </p>
                        )}
                        <QueryBody query={reservations}>
                          <Table
                            rows={reservationRows.slice(0, 4)}
                            emptyTitle="No holds"
                            emptyBody="No reservation windows on this project yet."
                            columns={[
                              {
                                key: 'reservation_id',
                                label: 'Hold',
                                render: (row) => (
                                  <Link className="font-medium text-primary hover:underline" to="/qrp/reservations">
                                    {shortId(String(row.reservation_id || ''), 10)}
                                  </Link>
                                ),
                              },
                              {
                                key: 'state',
                                label: 'State',
                                render: (row) => (
                                  <StatusBadge tone={stateTone(String(row.state || ''))} label={stateLabel(String(row.state || 'requested'))} />
                                ),
                              },
                              { key: 'resource_ref', label: 'Resource' },
                            ]}
                          />
                        </QueryBody>
                        </PanelHeader>
                      </Card>
                    </div>
                  </div>
                )}
              </QueryBody>
            )}

            {tab === 'members' && (
              <Card className="space-y-3">
                <PanelHeader title="Members">
                <MemberForm projectId={projectId} />
                <QueryBody query={members}>
                  <Table
                    rows={memberRows}
                    emptyTitle="No members listed"
                    emptyBody="Add a directory user with editor or viewer role."
                    columns={[
                      { key: 'username', label: 'User' },
                      { key: 'role', label: 'Role' },
                    ]}
                  />
                </QueryBody>
                </PanelHeader>
              </Card>
            )}

            {tab === 'requests' && (
              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="space-y-3">
                  <PanelHeader
                    title="Create resource request"
                    tip="Guided submit flow — you land on the approval record when review opens."
                  />
                  {locked ? (
                    <EmptyState title="Submission locked" body="This project is locked while a review is in progress." />
                  ) : archived ? (
                    <EmptyState title="Archived" body="Unarchive before submitting new requests." />
                  ) : (
                    <button type="button" className={buttonClass} onClick={() => setSubmitOpen(true)}>
                      Open submit wizard
                    </button>
                  )}
                </Card>
                <Card className="space-y-3">
                  <PanelHeader
                    title="Project requests"
                    action={
                      <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/approvals">
                        Queue
                      </Link>
                    }
                  >
                  <QueryBody query={approvals}>
                    <Table
                      rows={approvalRows}
                      emptyTitle="No requests yet"
                      emptyBody="Submit a request to open a workload on the configured policy stages."
                      columns={[
                        {
                          key: 'workload_id',
                          label: 'Request',
                          render: (row) => (
                            <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.workload_id}`}>
                              {shortId(String(row.workload_id || ''), 12)}
                            </Link>
                          ),
                        },
                        {
                          key: 'governance_state',
                          label: 'State',
                          render: (row) => (
                            <StatusBadge
                              tone={stateTone(String(row.governance_state || ''))}
                              label={stateLabel(String(row.governance_state || 'unknown'))}
                            />
                          ),
                        },
                        { key: 'created_by', label: 'Requester' },
                      ]}
                    />
                  </QueryBody>
                  </PanelHeader>
                </Card>
              </div>
            )}

            {tab === 'reservations' && (
              <div className="space-y-4">
                <Card className="space-y-3">
                  <PanelHeader
                    title="Reservation holds"
                    action={
                      <Link className="fs-link text-sm" to="/qrp/scheduling">
                        Request window
                      </Link>
                    }
                  >
                  <QueryBody query={reservations}>
                    <Table
                      rows={reservationRows}
                      emptyTitle="No holds"
                      emptyBody="Request a window after (or while planning) governance approval."
                      columns={[
                        {
                          key: 'reservation_id',
                          label: 'Hold',
                          render: (row) => (
                            <Link className="font-medium text-primary hover:underline" to="/qrp/reservations">
                              {shortId(String(row.reservation_id || ''), 12)}
                            </Link>
                          ),
                        },
                        {
                          key: 'state',
                          label: 'State',
                          render: (row) => (
                            <StatusBadge tone={stateTone(String(row.state || ''))} label={stateLabel(String(row.state || 'requested'))} />
                          ),
                        },
                        { key: 'resource_ref', label: 'Resource' },
                        { key: 'window_start', label: 'Start' },
                        { key: 'window_end', label: 'End' },
                      ]}
                    />
                  </QueryBody>
                  </PanelHeader>
                </Card>
                <Card>
                  <PanelHeader title="Hold calendar" />
                  <QueryBody query={reservations}>
                    <ReservationCalendar rows={reservationRows} title={`${projectName} holds`} />
                  </QueryBody>
                </Card>
              </div>
            )}

            {tab === 'usage' && (
              <Card className="space-y-3">
                <PanelHeader
                  title="Quota & usage"
                  action={
                    <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/quotas">
                      Institution ledger
                    </Link>
                  }
                />
                {quota.isError ? (
                  <EmptyState title="Quota unavailable" body={message(quota.error)} />
                ) : quota.isPending ? (
                  <div className="h-32 animate-pulse rounded-lg bg-muted" />
                ) : (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Used (today UTC)</dt>
                      <dd className="mt-1 text-xl font-semibold tabular-nums">{String(quota.data?.used_shots ?? '—')}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Cap</dt>
                      <dd className="mt-1 text-xl font-semibold tabular-nums">{String(quota.data?.daily_shots_cap ?? '—')}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Remaining</dt>
                      <dd className="mt-1 text-xl font-semibold tabular-nums">{String(quota.data?.remaining_shots ?? '—')}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Window</dt>
                      <dd className="mt-1 font-medium">{String(quota.data?.window || 'today')}</dd>
                    </div>
                  </dl>
                )}
              </Card>
            )}

            {tab === 'activity' && (
              <Card className="space-y-3">
                <PanelHeader
                  title="Governance activity"
                  action={
                    <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/audit">
                      Audit trail
                    </Link>
                  }
                >
                {activity.isError ? (
                  <EmptyState title="Activity unavailable" body={message(activity.error)} />
                ) : (
                  <Table
                    rows={activityRows}
                    emptyTitle="No activity yet"
                    emptyBody="Approval decisions for this project appear here after reviews."
                    columns={[
                      { key: 'timestamp', label: 'When' },
                      { key: 'actor', label: 'Actor' },
                      { key: 'action', label: 'Action' },
                      {
                        key: 'target_id',
                        label: 'Request',
                        render: (row) =>
                          row.target_id ? (
                            <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.target_id}`}>
                              {shortId(String(row.target_id), 12)}
                            </Link>
                          ) : (
                            '—'
                          ),
                      },
                    ]}
                  />
                )}
                </PanelHeader>
              </Card>
            )}
          </RecordWorkspace>
        </>
      )}
    </Page>
  )
}
