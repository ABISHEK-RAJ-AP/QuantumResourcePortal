import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { qre, text } from '@/api/qre'
import { CopyableId } from '@/components/data/CopyableId'
import { Card, MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { policyDisplayName, policyVersion, stagePermission } from '@/lib/qreFields'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function PoliciesPage() {
  const query = useQuery({
    queryKey: ['policy'],
    queryFn: () => qre<Row>('/approvals/policy'),
  })
  const summary = useQuery({
    queryKey: ['governance-summary-policies'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
  })
  const stages = Array.isArray(query.data?.stages) ? (query.data?.stages as Row[]) : []
  const counts = (summary.data?.counts as Row | undefined) ?? {}
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/policies' },
        { label: 'Policies' },
      ]}
      title="Policies"
      {...opsPageGuidance.policies}
      actions={
        <Link className="btn-primary" to="/qrp/approvals">
          Review queue
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="In queue" value={summary.isError ? '—' : summary.data?.queue} tone="primary" />
        <MetricTile label="In review" value={summary.isError ? '—' : counts.in_review} />
        <MetricTile label="Approved" value={summary.isError ? '—' : counts.approved} tone="success" />
        <MetricTile label="Rejected" value={summary.isError ? '—' : counts.rejected} tone="critical" />
      </div>
      <QueryBody query={query}>
        <Card className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Policy</dt>
              <dd className="mt-1 flex items-center gap-2 font-mono text-xs">
                {text(query.data ?? {}, 'policy_id')}
                <CopyableId value={String(query.data?.policy_id || '')} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Version</dt>
              <dd className="mt-1 font-medium">{policyVersion(query.data as Row | undefined)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Stages</dt>
              <dd className="mt-1 tabular-nums font-medium">{stages.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Name</dt>
              <dd className="mt-1 font-medium">{policyDisplayName(query.data as Row | undefined)}</dd>
            </div>
          </dl>
          {stages.length > 0 && (
            <ol className="flex flex-wrap gap-2" aria-label="Policy stage order">
              {stages.map((stage, index) => (
                <li
                  key={String(stage.id || index)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <span>
                    <span className="font-medium">{text(stage, 'label')}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{text(stage, 'id')}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <Table
            rows={stages}
            emptyTitle="No stages published"
            emptyBody="The approval policy has no stages yet."
            columns={[
              { key: 'id', label: 'Stage' },
              { key: 'label', label: 'Label' },
              { key: 'required_permission', label: 'Permission', render: (row) => stagePermission(row) },
            ]}
          />
        </Card>
      </QueryBody>
      <RelatedNav
        items={[
          { to: '/qrp/organization', label: 'Organization' },
          { to: '/qrp/approvals', label: 'Review queue' },
          { to: '/qrp/projects', label: 'Projects' },
          { to: '/qrp/quotas', label: 'Quotas' },
        ]}
      />
    </Page>
  )
}
