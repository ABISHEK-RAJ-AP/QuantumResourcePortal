import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { KpiStrip } from '@/components/data/KpiStrip'
import { qre } from '@/api/qre'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function EntitlementsPage() {
  const ledger = useQuery({
    queryKey: ['entitlements-ledger'],
    queryFn: () => qre<Row>('/quotas/ledger?window=today'),
    retry: false,
  })
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/quotas' },
        { label: 'Entitlements' },
      ]}
      title="Entitlements"
      {...opsPageGuidance.entitlements}
      actions={
        <Link className="btn-primary" to="/qrp/quotas">
          Quotas
        </Link>
      }
      updatedAt={ledger.dataUpdatedAt}
    >
      <KpiStrip className="sm:grid-cols-3">
        <MetricTile
          label="Today's cap"
          value={ledger.isError ? '—' : ledger.data?.daily_cap}
          hint="Simulation shots"
          labelTip={opsPageGuidance.entitlementsScope.descriptionHelp}
        />
        <MetricTile label="Used" value={ledger.isError ? '—' : ledger.data?.used_today} hint="Ledger window" />
        <MetricTile
          label="Remaining"
          value={ledger.isError ? '—' : ledger.data?.remaining}
          hint="Before approve"
          tone="primary"
        />
      </KpiStrip>
      <RelatedNav
        items={[
          { to: '/qrp/quotas', label: 'Quotas' },
          { to: '/qrp/admin/users', label: 'People & access' },
          { to: '/qrp/reservations', label: 'Reservations' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}