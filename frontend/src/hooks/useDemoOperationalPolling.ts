import { useQuery } from '@tanstack/react-query'

import { fetchDemoSimulationStatus } from '@/api/demoSimulation'
import { demoActionsAllowed } from '@/lib/demo'

/** Refetch interval when lab demo simulation is mutating persisted ops data. */
export function useDemoOperationalPolling(): number | false {
  const sim = useQuery({
    queryKey: ['demo-simulation-status'],
    queryFn: fetchDemoSimulationStatus,
    enabled: demoActionsAllowed,
    staleTime: 15_000,
    retry: false,
  })
  if (!demoActionsAllowed) return false
  if (sim.data?.enabled && !sim.data?.paused) return 20_000
  return false
}