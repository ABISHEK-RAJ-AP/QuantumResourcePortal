import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { useDemoOperationalPolling } from '@/hooks/useDemoOperationalPolling'
import { Card, Page, PanelHeader, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { ExecutionTimeline } from '@/components/workflow/ExecutionTimeline'
import { RecordWorkspace } from '@/components/workflow/RecordWorkspace'
import { QueryBody, Table, shortId } from '@/pages/workspace/shared/helpers'
import { formatDateTime } from '@/lib/display'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function JobDetailPage() {
  const { jobId = '' } = useParams()
  const pollMs = useDemoOperationalPolling()
  const [tab, setTab] = useState('overview')
  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => qre<Row>(`/jobs/${encodeURIComponent(jobId)}`),
    enabled: !!jobId,
    refetchInterval: pollMs,
  })
  const dispatch = useQuery({
    queryKey: ['job-dispatch', jobId],
    queryFn: async () =>
      asList(await qre<unknown>('/dispatch-attempts')).filter((r) => String(r.external_job_id || '') === jobId),
    enabled: !!jobId,
    refetchInterval: pollMs,
    retry: false,
  })
  const status = String(query.data?.status || '')
  const timeline = Array.isArray(query.data?.timeline) ? (query.data.timeline as Row[]) : []
  const tabCrumb =
    tab === 'timeline' ? 'Timeline' : tab === 'dispatch' ? 'Dispatch' : null
  return (
    <Page
      crumbs={[
        { label: 'Compute', to: '/qrp/jobs' },
        { label: 'Jobs', to: '/qrp/jobs' },
        { label: shortId(jobId, 12), to: `/qrp/jobs/${jobId}` },
        ...(tabCrumb ? [{ label: tabCrumb }] : []),
      ]}
      title={status ? stateLabel(status) : 'Provider job'}
      description={opsPageGuidance.jobDetail.description}
      descriptionHelp={`${opsPageGuidance.jobDetail.descriptionHelp} ID ${shortId(jobId, 14)}.`}
      actions={<CopyableId value={jobId} keep={16} />}
      updatedAt={query.dataUpdatedAt}
    >
      <QueryBody query={query}>
        {query.data && (
          <RecordWorkspace
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'timeline', label: 'Execution timeline', count: timeline.length },
              { id: 'dispatch', label: 'Dispatch', count: dispatch.data?.length ?? 0 },
            ]}
            activeTab={tab}
            onTabChange={setTab}
            related={[
              { to: '/qrp/jobs', label: 'All jobs' },
              { to: '/qrp/reconciliation', label: 'Reconciliation' },
              query.data.backend_id
                ? {
                    to: `/qrp/backends/${query.data.backend_id}`,
                    label: 'Backend',
                    hint: String(query.data.backend_id),
                  }
                : { to: '/qrp/inventory', label: 'Resources', hint: 'Catalogue' },
              { to: '/qrp/reconciliation', label: 'Reconcile', hint: `${dispatch.data?.length ?? 0} attempts` },
            ]}
          >
            {tab === 'overview' && (
              <Card className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Provider status</span>
                  <StatusBadge tone={stateTone(status.toLowerCase())} label={stateLabel(status || 'unknown')} />
                </div>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Backend</dt>
                    <dd className="mt-1 font-medium">
                      {query.data.backend_id ? (
                        <Link className="text-primary hover:underline" to={`/qrp/backends/${query.data.backend_id}`}>
                          {text(query.data, 'backend_id')}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Runtime</dt>
                    <dd className="mt-1 font-medium">{text(query.data, 'runtime')}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Submitted</dt>
                    <dd className="mt-1 tabular-nums text-muted-foreground">
                      {formatDateTime(String(query.data.submitted_at || '')) || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Failure category</dt>
                    <dd className="mt-1">{text(query.data, 'failure_category_label') || '—'}</dd>
                  </div>
                </dl>
                {query.data.failure_reason ? (
                  <p className="rounded-lg border border-critical/30 bg-critical-soft/40 px-3 py-2 text-sm text-critical-text">
                    {text(query.data, 'failure_reason')}
                  </p>
                ) : null}
              </Card>
            )}
            {tab === 'timeline' && (
              <Card>
                <PanelHeader title="Execution timeline" />
                <ExecutionTimeline
                  events={timeline.map((e) => ({ state: String(e.state || ''), at: e.at ? String(e.at) : undefined }))}
                  emptyBody="Provider has not reported stage transitions for this job yet."
                />
              </Card>
            )}
            {tab === 'dispatch' && (
              <Card>
                <PanelHeader title="Linked dispatch attempts">
                <Table
                  rows={dispatch.data ?? []}
                  emptyTitle="No dispatch rows"
                  emptyBody="Organization dispatch attempts appear when reconcile links external_job_id to this provider job."
                  columns={[
                    {
                      key: 'attempt_id',
                      label: 'Attempt',
                      render: (r) => <CopyableId value={String(r.attempt_id || '')} keep={10} />,
                    },
                    {
                      key: 'workload_id',
                      label: 'Workload',
                      render: (r) =>
                        r.workload_id ? (
                          <Link className="text-primary hover:underline" to={`/qrp/approvals/${r.workload_id}`}>
                            {shortId(String(r.workload_id), 12)}
                          </Link>
                        ) : (
                          '—'
                        ),
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
            )}
          </RecordWorkspace>
        )}
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/jobs', label: 'All jobs' },
          { to: '/qrp/dispatch', label: 'Dispatch' },
          { to: '/qrp/reconciliation', label: 'Reconciliation' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}

