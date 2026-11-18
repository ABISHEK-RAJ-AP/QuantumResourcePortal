import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchDemoSimulationStatus,
  pauseDemoSimulation,
  resumeDemoSimulation,
  startDemoSimulation,
  stopDemoSimulation,
  tickDemoSimulation,
} from '@/api/demoSimulation'
import { useAuth } from '@/auth/hooks'
import { demoActionsAllowed } from '@/lib/demo'
import { cn } from '@/lib/utils'

/** Visible whenever lab simulation is running — not provider telemetry. */
export function DemoSimulationBanner() {
  const client = useQueryClient()
  const { user } = useAuth()
  const isAdmin = (user?.roles?.[0] || '').toLowerCase().includes('admin')

  const status = useQuery({
    queryKey: ['demo-simulation-status'],
    queryFn: fetchDemoSimulationStatus,
    enabled: demoActionsAllowed,
    refetchInterval: (q) => (q.state.data?.enabled && !q.state.data?.paused ? 30_000 : 60_000),
    retry: false,
  })

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['demo-simulation-status'] })
    void client.invalidateQueries()
  }

  const start = useMutation({
    mutationFn: () => startDemoSimulation(1),
    onSuccess: invalidate,
  })
  const pause = useMutation({ mutationFn: pauseDemoSimulation, onSuccess: invalidate })
  const resume = useMutation({ mutationFn: resumeDemoSimulation, onSuccess: invalidate })
  const stop = useMutation({ mutationFn: stopDemoSimulation, onSuccess: invalidate })
  const tick = useMutation({ mutationFn: tickDemoSimulation, onSuccess: invalidate })

  if (!demoActionsAllowed || status.isError || !status.data?.available) return null

  const active = Boolean(status.data.enabled && !status.data.paused)

  return (
    <div
      className={cn(
        'border-b px-4 py-2 text-sm sm:px-6',
        active
          ? 'border-warning/40 bg-warning-soft text-warning-text'
          : 'border-border bg-muted/50 text-muted-foreground',
      )}
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {active ? 'DEMO SIMULATION' : 'Demo environment'}
          <span className="ms-2 font-normal opacity-90">
            {active
              ? 'Operational changes are simulated and written to the database — not live provider telemetry.'
              : status.data.demo_data
                ? 'Demonstration data loaded. Start simulation to see queue and job movement.'
                : 'Load demo data to populate the portal.'}
          </span>
        </p>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            {!status.data.enabled ? (
              <button
                type="button"
                className="rounded-md border border-current/30 px-2 py-0.5 text-xs font-semibold hover:bg-background/40"
                disabled={start.isPending}
                onClick={() => start.mutate()}
              >
                Start simulation
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-md border border-current/30 px-2 py-0.5 text-xs font-semibold hover:bg-background/40"
                  disabled={pause.isPending}
                  onClick={() => (status.data.paused ? resume.mutate() : pause.mutate())}
                >
                  {status.data.paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-current/30 px-2 py-0.5 text-xs font-semibold hover:bg-background/40"
                  disabled={tick.isPending}
                  onClick={() => tick.mutate()}
                >
                  Advance tick
                </button>
                <button
                  type="button"
                  className="rounded-md border border-current/30 px-2 py-0.5 text-xs font-semibold hover:bg-background/40"
                  disabled={stop.isPending}
                  onClick={() => stop.mutate()}
                >
                  Stop
                </button>
              </>
            )}
          </div>
        ) : null}
        {status.data.last_tick_at ? (
          <p className="w-full text-xs tabular-nums opacity-80 sm:w-auto sm:ms-auto">
            Last simulation tick{' '}
            {new Date(status.data.last_tick_at).toLocaleString(undefined, {
              timeStyle: 'medium',
              dateStyle: 'short',
            })}
          </p>
        ) : null}
      </div>
    </div>
  )
}