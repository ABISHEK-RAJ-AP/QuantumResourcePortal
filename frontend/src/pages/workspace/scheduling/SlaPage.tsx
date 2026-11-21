import { useQuery } from '@tanstack/react-query'
import { MetricTile, Page, RelatedNav } from '@/components/layout/Page'
import { KpiStrip } from '@/components/data/KpiStrip'
import { asList, qre } from '@/api/qre'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function SlaPage() {
  const meter = useQuery({
    queryKey: ['sla-meter-peek'],
    queryFn: () => qre<Row>('/meter-rollups?hours=24'),
    retry: false,
  })
  const rollups = asList(meter.data).length
  return (
    <Page
      crumbs={[
        { label: 'Governance', to: '/qrp/metering' },
        { label: 'SLA' },
      ]}
      title="Service levels"
      {...opsPageGuidance.sla}
      updatedAt={meter.dataUpdatedAt}
    >
      <KpiStrip className="sm:grid-cols-3">
        <MetricTile
          label="SLA ledger"
          value="Not in scope"
          hint="No breach API"
          tone="neutral"
          labelTip={opsPageGuidance.slaScope.descriptionHelp}
        />
        <MetricTile label="24 h rollups" value={meter.isError ? '—' : rollups} hint="Observed usage sample" />
        <MetricTile label="Credits" value="Not in scope" hint="Finance integration deferred" />
      </KpiStrip>
      <RelatedNav
        items={[
          { to: '/qrp/metering', label: 'Metering' },
          { to: '/qrp/incidents', label: 'Incidents' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}