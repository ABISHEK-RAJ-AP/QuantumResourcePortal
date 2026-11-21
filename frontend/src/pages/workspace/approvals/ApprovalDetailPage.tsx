import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import {
  Card,
  EmptyState,
  Page,
  PanelHeader,
  RelatedNav,
  stateLabel,
  stateTone,
} from '@/components/layout/Page'
import { fieldErrorClass } from '@/components/forms/FormField'
import { StatusBadge } from '@/components/status/StatusBadge'
import { InfoTip } from '@/components/ui/InfoTip'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { QuotaEvaluationPanel } from '@/components/workflow/QuotaEvaluationPanel'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { opsPageGuidance } from '@/lib/opsPageGuidance'
import { message, QueryBody, shortId, Table } from '@/pages/workspace/shared/helpers'
import {
  APPROVAL_PATH,
  progressSteps,
  type ApprovalRow,
} from '@/pages/workspace/approvals/approval-shared'
import { governanceStepIndexForState } from '@/lib/workflow/governance'
import { parseForm } from '@/lib/validation/parseForm'
import { approvalDecisionSchema } from '@/lib/validation/schemas'
import { formatDateTime, formatEnum } from '@/lib/display'
import { cn } from '@/lib/utils'

export function ApprovalDetailPage() {
  const { workloadId = '' } = useParams()
  const client = useQueryClient()
  const { openConfirm, confirmDialog } = useConfirmDialog()
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [tab, setTab] = useState('overview')

  const tabCrumb =
    tab === 'governance'
      ? 'Governance'
      : tab === 'decide'
        ? 'Decide'
        : tab === 'activity'
          ? 'Activity'
          : tab === 'ops'
            ? 'Operations'
            : null
  const query = useQuery({
    queryKey: ['approval', workloadId],
    queryFn: () => qre<ApprovalRow>(`/approvals/${encodeURIComponent(workloadId)}`),
    enabled: !!workloadId,
  })
  const quota = useQuery({
    queryKey: ['quota-eval', workloadId],
    queryFn: () => qre<ApprovalRow>(`/quotas/evaluate?workload_id=${encodeURIComponent(workloadId)}`),
    enabled: !!workloadId,
    retry: false,
  })
  const decide = useMutation({
    mutationFn: (decision: string) => {
      const progress = (query.data?.governance_progress as ApprovalRow | undefined) ?? {}
      const stage = (progress.current_stage as ApprovalRow | undefined) ?? {}
      return qre(`/approvals/${encodeURIComponent(workloadId)}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          comment: comment || decision,
          expected_stage_id: stage.id,
        }),
      })
    },
    onSuccess: () => {
      setComment('')
      void client.invalidateQueries({ queryKey: ['approval', workloadId] })
      void client.invalidateQueries({ queryKey: ['approvals'] })
      void client.invalidateQueries({ queryKey: ['governance-summary'] })
    },
  })
  const confirmDecide = (decision: string) => {
    if (decide.isPending) return
    setCommentError('')
    const d = decision as 'approve' | 'reject' | 'changes_requested'
    if (d === 'approve' || d === 'reject' || d === 'changes_requested') {
      const parsed = parseForm(approvalDecisionSchema, {
        decision: d,
        comment,
        requireRationale: false,
      })
      if (!parsed.ok) {
        setCommentError(parsed.fieldErrors.comment || parsed.formError || 'Fix validation errors')
        setTab('decide')
        return
      }
    }
    openConfirm({
      title: 'Record decision',
      body: (
        <>
          Record <strong>{formatEnum(decision)}</strong> for request {shortId(workloadId, 14)}? Your comment is stored on the audit trail.
        </>
      ),
      confirmLabel: 'Record decision',
      danger: decision === 'reject',
      onConfirm: () => decide.mutate(decision),
    })
  }
  const withdraw = useMutation({
    mutationFn: () =>
      qre(`/approvals/${encodeURIComponent(workloadId)}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment || 'withdraw' }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['approval', workloadId] }),
  })
  const confirmWithdraw = () => {
    if (withdraw.isPending) return
    openConfirm({
      title: 'Withdraw request',
      body: `Withdraw ${shortId(workloadId, 14)}? The requester can edit and resubmit.`,
      confirmLabel: 'Withdraw',
      danger: true,
      onConfirm: () => withdraw.mutate(),
    })
  }
  const row = query.data
  const trail = row ? progressSteps(row) : { steps: APPROVAL_PATH, index: 0 }
  const progress = (row?.governance_progress as ApprovalRow | undefined) ?? {}
  const stage = (progress.current_stage as ApprovalRow | undefined) ?? {}
  const history = Array.isArray(row?.history) ? (row.history as ApprovalRow[]) : []
  const closed = ['approved', 'rejected', 'withdrawn'].includes(String(row?.governance_state || ''))
  const projectId = row?.project_id ? String(row.project_id) : ''
  const relatedReservations = useQuery({
    queryKey: ['approval-reservations', projectId],
    queryFn: async () => asList(await qre<unknown>(`/reservations?project_id=${encodeURIComponent(projectId)}`)),
    enabled: !!projectId,
    retry: false,
  })
  const relatedAttempts = useQuery({
    queryKey: ['approval-dispatch', workloadId],
    queryFn: async () =>
      asList(await qre<unknown>('/dispatch-attempts')).filter((r) => String(r.workload_id || '') === workloadId),
    enabled: !!workloadId,
    retry: false,
  })
  const govState = String(row?.governance_state || '')
  const nextHint =
    govState === 'submitted_for_review' || govState === 'in_review'
      ? `Decide · ${text(stage, 'label')}`
      : govState === 'approved'
        ? 'Approved. Request hold next.'
        : govState === 'rejected' || govState === 'withdrawn'
          ? 'Closed.'
          : text(stage, 'label')

  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/approvals' },
        { label: 'Queue', to: '/qrp/approvals' },
        { label: shortId(workloadId, 10), to: `/qrp/approvals/${workloadId}` },
        ...(tabCrumb ? [{ label: tabCrumb }] : []),
      ]}
      title={row ? stateLabel(String(row.governance_state || 'review')) : 'Request'}
      description={
        row
          ? `Stage ${Number(progress.stage_index ?? 0) + 1} of ${progress.stage_total ?? trail.steps.length}`
          : opsPageGuidance.approvalDetail.description
      }
      descriptionHelp={row ? String(text(stage, 'label')) : opsPageGuidance.approvalDetail.descriptionHelp}
      steps={trail.steps.length > 0 ? trail.steps : APPROVAL_PATH}
      stepIndex={row ? trail.index : governanceStepIndexForState(govState)}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <CopyableId value={workloadId} keep={16} />
          <InfoTip label="Approval scope">
            Organization-scoped decision: writes to audit and advances stages. Does not dispatch a provider job. After approved: schedule hold → authorize dispatch.
          </InfoTip>
          <Link to="/qrp/approvals" className="fs-link text-sm">
            Queue
          </Link>
          {govState === 'approved' ? (
            <Link to="/qrp/scheduling" className="btn-primary">
              Request hold
            </Link>
          ) : null}
        </span>
      }
      updatedAt={query.dataUpdatedAt}
    >
      <QueryBody query={query}>
        {row && (
          <>
            <RecordWorkspace
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'governance', label: 'Governance' },
                { id: 'decide', label: 'Decide' },
                { id: 'activity', label: 'Activity', count: history.length },
                { id: 'ops', label: 'Operations', count: relatedAttempts.data?.length ?? 0 },
              ]}
              activeTab={tab}
              onTabChange={setTab}
              nextAction={{
                title: closed ? 'Closed' : `Decide · ${text(stage, 'label')}`,
                body: nextHint,
                blockers: quota.data && !quota.data.allowed ? ['Over daily shot cap'] : undefined,
                primary: closed
                  ? govState === 'approved'
                    ? { to: '/qrp/scheduling', label: 'Request hold' }
                    : { to: '/qrp/approvals', label: 'Queue' }
                  : tab === 'decide'
                    ? undefined
                    : { label: 'Decide', onClick: () => setTab('decide') },
                secondary: { to: '/qrp/approvals', label: 'Queue' },
              }}
              related={[
                ...(projectId ? [{ to: `/qrp/projects/${projectId}`, label: 'Project', hint: shortId(projectId, 14) }] : []),
                { to: '/qrp/quotas', label: 'Quotas', hint: quota.data ? (quota.data.allowed ? 'Within cap' : 'Over cap') : '—' },
                {
                  to: '/qrp/reservations',
                  label: 'Holds',
                  hint: relatedReservations.isError ? '—' : `${relatedReservations.data?.length ?? 0}`,
                },
                {
                  to: '/qrp/reconciliation',
                  label: 'Dispatch',
                  hint: relatedAttempts.isError ? '—' : `${relatedAttempts.data?.length ?? 0}`,
                },
                { to: '/qrp/audit', label: 'Audit' },
                { to: '/qrp/organization', label: 'Organization', hint: 'Tenant identity' },
              ]}
            >
              {tab === 'overview' && (
                <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <PanelHeader title="Request" />
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Requester</dt>
                      <dd className="mt-1 font-medium">{text(row, 'created_by')}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">State</dt>
                      <dd className="mt-1">
                        <StatusBadge
                          tone={stateTone(String(row.governance_state || ''))}
                          label={stateLabel(String(row.governance_state || 'unknown'))}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Stage</dt>
                      <dd className="mt-1 font-medium">
                        {text(stage, 'label')} ({String(Number(progress.stage_index ?? 0) + 1)}/
                        {String(progress.stage_total ?? trail.steps.length)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Submitted</dt>
                      <dd className="mt-1 text-xs text-muted-foreground">{text(row, 'created_at')}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Project</dt>
                      <dd className="mt-1">
                        {row.project_id ? (
                          <Link className="font-mono text-xs text-primary hover:underline break-all" to={`/qrp/projects/${row.project_id}`}>
                            {text(row, 'project_id')}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Package SHA-256</dt>
                      <dd className="mt-1 font-mono text-xs break-all text-muted-foreground">{text(row, 'package_sha256')}</dd>
                    </div>
                    {(() => {
                      const meta = (row.metadata as ApprovalRow | undefined) ?? {}
                      const shots = meta.shots ?? meta.requested_shots
                      const qubits = meta.qubits
                      const depth = meta.depth
                      if (shots == null && qubits == null && depth == null) return null
                      return (
                        <>
                          <div>
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Shots</dt>
                            <dd className="mt-1 font-semibold tabular-nums">{shots != null ? String(shots) : '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Qubits / depth</dt>
                            <dd className="mt-1 tabular-nums">
                              {qubits != null ? String(qubits) : '—'}
                              {depth != null ? ` · depth ${depth}` : ''}
                            </dd>
                          </div>
                          {meta.backend_hint ? (
                            <div className="sm:col-span-2">
                              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Backend hint</dt>
                              <dd className="mt-1 font-mono text-xs">{String(meta.backend_hint)}</dd>
                            </div>
                          ) : null}
                        </>
                      )
                    })()}
                  </dl>
                </Card>
                <QuotaEvaluationPanel query={quota} />
                </div>
              )}

              {tab === 'governance' && (
                <div className="grid gap-5 lg:grid-cols-2">
                  <Card>
                    <PanelHeader title="Policy" />
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Policy</dt>
                        <dd className="mt-1">
                          {text(progress, 'policy_id')} · v{text(progress, 'policy_version')}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Current stage</dt>
                        <dd className="mt-1 font-medium">{text(stage, 'label')}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Required permission</dt>
                        <dd className="mt-1 font-mono text-xs">{text(stage, 'required_permission')}</dd>
                      </div>
                    </dl>
                    <Link className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" to="/qrp/policies">
                      Open full policy →
                    </Link>
                  </Card>
                  <QuotaEvaluationPanel query={quota} />
                </div>
              )}

              {tab === 'decide' && (
                <Card className="space-y-4">
                  <PanelHeader
                    title="Decision"
                    tip="Approve, request changes, or reject for the current stage. Withdraw returns the package to the requester."
                  />
                  {!closed && (
                    <>
                      <textarea
                        className={cn('field-input min-h-[88px]', fieldErrorClass(Boolean(commentError)))}
                        rows={3}
                        placeholder="Decision rationale (required for reject / request changes)"
                        value={comment}
                        aria-invalid={Boolean(commentError)}
                        onChange={(event) => {
                          setComment(event.target.value)
                          if (commentError) setCommentError('')
                        }}
                      />
                      {commentError ? (
                        <p className="text-sm text-critical" role="alert">
                          {commentError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => confirmDecide('approve')}
                          className="rounded-xl bg-success px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => confirmDecide('changes_requested')}
                          className="rounded-xl bg-warning px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Request changes
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => confirmDecide('reject')}
                          className="rounded-xl bg-critical px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button type="button" disabled={withdraw.isPending} onClick={confirmWithdraw} className="btn-ghost">
                          Withdraw
                        </button>
                      </div>
                    </>
                  )}
                  {closed && (
                    <p className="text-sm text-muted-foreground">This workload is closed ({stateLabel(String(row.governance_state))}).</p>
                  )}
                  {decide.error && <p className="text-sm text-critical">{message(decide.error)}</p>}
                  {withdraw.error && <p className="text-sm text-critical">{message(withdraw.error)}</p>}
                </Card>
              )}

              {tab === 'activity' && (
                <Card>
                  <PanelHeader
                    title="Stage / decision history"
                    tip="Append-only trail — first review decision starts the history."
                  />
                  {history.length === 0 && <EmptyState title="No decisions yet" body="Act on the Decide tab to open the trail." />}
                  <ul className="divide-y divide-border/70">
                    {history.map((record, idx) => {
                      const verb = String(record.decision || record.action || 'note')
                      const when = record.at || record.created_at
                      return (
                      <li key={String(record.record_id || `${verb}-${idx}`)} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            tone={stateTone(verb)}
                            label={stateLabel(verb)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {text(record, 'actor_username') || text(record, 'actor_id')} · {text(record, 'stage_id')}
                            {when ? ` · ${formatDateTime(String(when))}` : ''}
                          </span>
                        </div>
                        <p className="text-sm">{text(record, 'comment')}</p>
                      </li>
                    )})}
                  </ul>
                </Card>
              )}

              {tab === 'ops' && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <PanelHeader
                      title="Dispatch attempts"
                      action={
                        <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/reconciliation">
                          Reconcile
                        </Link>
                      }
                    >
                    <Table
                      rows={relatedAttempts.data ?? []}
                      emptyTitle="No attempts for this request"
                      emptyBody="Attempts appear after authorise and record-attempt. Approved workloads are not dispatched automatically."
                      columns={[
                        {
                          key: 'attempt_id',
                          label: 'Attempt',
                          render: (r) => <CopyableId value={String(r.attempt_id || '')} keep={10} />,
                        },
                        {
                          key: 'dispatch_state',
                          label: 'State',
                          render: (r) => (
                            <StatusBadge
                              tone={stateTone(String(r.dispatch_state || ''))}
                              label={stateLabel(String(r.dispatch_state || 'open'))}
                            />
                          ),
                        },
                      ]}
                    />
                    </PanelHeader>
                  </Card>
                  <Card>
                    <PanelHeader
                      title="Project holds"
                      action={
                        <Link className="text-xs font-medium text-primary hover:underline" to="/qrp/reservations">
                          All holds
                        </Link>
                      }
                    >
                    <Table
                      rows={(relatedReservations.data ?? []).slice(0, 8)}
                      emptyTitle="No holds on project"
                      emptyBody="Schedule hold after approval if capacity window needed."
                      columns={[
                        {
                          key: 'reservation_id',
                          label: 'Hold',
                          render: (r) => <CopyableId value={String(r.reservation_id || '')} keep={10} />,
                        },
                        {
                          key: 'state',
                          label: 'State',
                          render: (r) => (
                            <StatusBadge tone={stateTone(String(r.state || ''))} label={stateLabel(String(r.state || 'requested'))} />
                          ),
                        },
                        { key: 'resource_ref', label: 'Resource' },
                      ]}
                    />
                    </PanelHeader>
                  </Card>
                </div>
              )}
            </RecordWorkspace>
          </>
        )}
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/approvals', label: 'Review queue' },
          { to: '/qrp/policies', label: 'Policies' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
      {confirmDialog}
    </Page>
  )
}
