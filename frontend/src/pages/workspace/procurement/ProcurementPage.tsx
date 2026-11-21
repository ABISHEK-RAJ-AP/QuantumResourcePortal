import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { qre } from '@/api/qre'
import { MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { KpiStrip } from '@/components/data/KpiStrip'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function ProcurementPage() {
  const summary = useQuery({
    queryKey: ['procurement-scope-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
  })
  return (
    <Page
      crumbs={[
        { label: 'Resources', to: '/qrp/inventory' },
        { label: 'Procurement' },
      ]}
      title="Procurement"
      {...opsPageGuidance.procurement}
      actions={
        <Link className="btn-primary" to="/qrp/inventory">
          Inventory
        </Link>
      }
      updatedAt={summary.dataUpdatedAt}
    >
      <KpiStrip className="sm:grid-cols-3">
        <MetricTile
          label="Open reviews"
          value={summary.isError ? '—' : summary.data?.queue}
          hint="Governance queue"
          labelTip="Workload items waiting for a reviewer decision."
        />
        <MetricTile
          label="In review"
          value={summary.isError ? '—' : (summary.data?.counts as Row | undefined)?.in_review}
          hint="Active stages"
          labelTip="Approvals with at least one stage in progress."
        />
        <MetricTile
          label="Policy"
          value="Published"
          hint="Live version"
          labelTip="Approvals use the currently published policy version."
        />
      </KpiStrip>
      <RelatedNav
        items={[
          { to: '/qrp/quotas', label: 'Quotas' },
          { to: '/qrp/providers', label: 'Providers' },
          { to: '/qrp/reservations', label: 'Reservations' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}