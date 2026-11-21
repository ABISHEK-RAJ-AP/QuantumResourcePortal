import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { asList, qre, text } from '@/api/qre'
import { Card, Page, RelatedNav } from '@/components/layout/Page'
import { formatDateTime, formatEnum } from '@/lib/display'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

export function ApprovalHistoryPage() {
  const query = useQuery({
    queryKey: ['approval-history'],
    queryFn: () => qre<unknown>('/governance/activity?limit=80'),
  })
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/approvals' },
        { label: 'Decision history' },
      ]}
      title="Approval history"
      {...opsPageGuidance.approvalHistory}
      actions={
        <Link to="/qrp/approvals" className="text-sm font-medium text-primary hover:underline">
          Queue
        </Link>
      }
    >
      <Card>
        <QueryBody query={query}>
          <Table
            rows={asList(query.data)}
            columns={[
              { key: 'timestamp', label: 'When', render: (row) => formatDateTime(row.timestamp) },
              { key: 'actor', label: 'Actor' },
              { key: 'action', label: 'Decision', render: (row) => formatEnum(String(row.action ?? '')) },
              {
                key: 'target_id',
                label: 'Workload',
                render: (row) => (
                  <Link className="font-medium text-primary hover:underline" to={`/qrp/approvals/${row.target_id}`}>
                    {text(row, 'target_id')}
                  </Link>
                ),
              },
            ]}
          />
        </QueryBody>
      </Card>
      <RelatedNav
        items={[
          { to: '/qrp/approvals', label: 'Review queue' },
          { to: '/qrp/audit', label: 'Audit trail' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}