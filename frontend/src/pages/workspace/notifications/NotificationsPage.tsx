import { useQuery } from '@tanstack/react-query'
import { MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { KpiStrip } from '@/components/data/KpiStrip'
import { qre } from '@/api/qre'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function NotificationsPage() {
  const summary = useQuery({
    queryKey: ['notifications-governance-summary'],
    queryFn: () => qre<Row>('/governance/summary'),
    retry: false,
  })
  return (
    <Page
      crumbs={[
        { label: 'Workspace', to: '/qrp' },
        { label: 'Notifications' },
      ]}
      title="Notifications"
      {...opsPageGuidance.notifications}
      actions={
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.dispatchEvent(new CustomEvent('govern:open-notices'))}
        >
          Open panel
        </button>
      }
    >
      <KpiStrip className="sm:grid-cols-3">
        <MetricTile
          label="Queue"
          value={summary.isError ? '—' : summary.data?.queue}
          hint="Needs review"
          tone="primary"
          labelTip="Governance items that may generate in-app notices."
        />
        <MetricTile
          label="In review"
          value={summary.isError ? '—' : (summary.data?.counts as Row | undefined)?.in_review}
          hint="Open stages"
        />
        <MetricTile
          label="Delivery"
          value="In-app"
          hint="Header bell"
          labelTip="Email and webhooks are configured on the server when enabled."
        />
      </KpiStrip>
      <RelatedNav
        items={[
          { to: '/qrp/audit', label: 'Audit log' },
          { to: '/qrp/approvals/history', label: 'Approval history' },
          { to: '/qrp/approvals', label: 'Review queue' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}