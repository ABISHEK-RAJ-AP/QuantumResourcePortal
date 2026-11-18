import { useQuery } from '@tanstack/react-query'

import { fetchDemoSimulationStatus } from '@/api/demoSimulation'
import { demoActionsAllowed } from '@/lib/demo'

/** Shell header: connection freshness + optional demo simulation label. */
export function DataFreshness({ updatedAt }: { updatedAt?: number }) {
  const sim = useQuery({
    queryKey: ['demo-simulation-status'],
    queryFn: fetchDemoSimulationStatus,
    enabled: demoActionsAllowed,
    staleTime: 20_000,
    retry: false,
  })
  const activeSim = Boolean(sim.data?.enabled && !sim.data?.paused)

  if (!updatedAt && !activeSim) return null
  const d = updatedAt ? new Date(updatedAt) : null
  return (
    <div className="text-right text-xs text-muted-foreground">
      <p className="tabular-nums">
        <span className="font-medium text-foreground">Connected</span>
        {d ? (
          <>
            {' '}
            · Last updated {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </>
        ) : null}
      </p>
      {activeSim ? (
        <p className="font-semibold text-warning-text">Demo simulation</p>
      ) : demoActionsAllowed && sim.data?.demo_data ? (
        <p className="text-muted-foreground">Demonstration data</p>
      ) : null}
    </div>
  )
}
