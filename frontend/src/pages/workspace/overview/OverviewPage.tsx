import { useAuth } from '@/auth/hooks'
import { detectWorkspace } from '@/lib/workspace'

import { AdminOverview } from '@/pages/workspace/overview/AdminOverview'
import { ProviderOverview } from '@/pages/workspace/overview/ProviderOverview'
import { ResearcherOverview } from '@/pages/workspace/overview/ResearcherOverview'

export function OverviewPage() {
  const { user } = useAuth()
  const workspace = detectWorkspace(user?.roles)

  if (workspace === 'admin') return <AdminOverview />
  if (workspace === 'provider') return <ProviderOverview />
  return <ResearcherOverview />
}