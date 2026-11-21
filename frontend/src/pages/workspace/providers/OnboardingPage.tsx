import { useQuery } from '@tanstack/react-query'
import { asList, qre, text } from '@/api/qre'
import { Card, Page, RelatedNav, stateLabel, stateTone } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { QueryBody, Table } from '@/pages/workspace/shared/helpers'
import { opsPageGuidance } from '@/lib/opsPageGuidance'

type Row = Record<string, unknown>

export function OnboardingPage() {
  const query = useQuery({
    queryKey: ['providers'],
    queryFn: () => qre<unknown>('/providers'),
  })
  return (
    <Page
      crumbs={[{ label: 'Resources', to: '/qrp/providers' }, { label: 'Onboarding' }]}
      title="Provider onboarding board"
      {...opsPageGuidance.onboarding}
    >
      <Card>
        <QueryBody query={query}>
          <Table
            rows={asList(query.data)}
            columns={[
              { key: 'provider_name', label: 'Provider' },
              { key: 'provider_id', label: 'Id' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={stateTone(String(row.status || 'active'))} label={stateLabel(String(row.status || 'active'))} />,
              },
              {
                key: 'integration',
                label: 'Stage',
                render: (row) => {
                  const integration = (row.integration as Row | undefined) ?? {}
                  return text(integration, 'stage')
                },
              },
            ]}
          />
        </QueryBody>
      </Card>
      <RelatedNav
        items={[
          { to: '/qrp/providers', label: 'Providers' },
          { to: '/qrp/connectors', label: 'Connectors' },
          { to: '/qrp/organization', label: 'Organization' },
        ]}
      />
    </Page>
  )
}
