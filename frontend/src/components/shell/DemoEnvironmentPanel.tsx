import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchDemoSimulationStatus,
  pauseDemoSimulation,
  resumeDemoSimulation,
  startDemoSimulation,
  stopDemoSimulation,
} from '@/api/demoSimulation'
import { seedPortalDemo } from '@/api/seedDemo'
import { Card, PanelHeader } from '@/components/layout/Page'
import { StatusBadge } from '@/components/status/StatusBadge'
import { demoActionsAllowed } from '@/lib/demo'

/** Lab admin — demo seed + simulation (Settings only). */
export function DemoEnvironmentPanel() {
  const client = useQueryClient()
  const status = useQuery({
    queryKey: ['demo-simulation-status'],
    queryFn: fetchDemoSimulationStatus,
    enabled: demoActionsAllowed,
    retry: false,
  })
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['demo-simulation-status'] })
    void client.invalidateQueries()
  }
  const seed = useMutation({ mutationFn: seedPortalDemo, onSuccess: invalidate })
  const start = useMutation({ mutationFn: () => startDemoSimulation(1), onSuccess: invalidate })
  const pause = useMutation({ mutationFn: pauseDemoSimulation, onSuccess: invalidate })
  const resume = useMutation({ mutationFn: resumeDemoSimulation, onSuccess: invalidate })
  const stop = useMutation({ mutationFn: stopDemoSimulation, onSuccess: invalidate })

  if (!demoActionsAllowed) return null

  const busy =
    seed.isPending || start.isPending || pause.isPending || resume.isPending || stop.isPending
  const simOn = Boolean(status.data?.enabled)
  const simActive = simOn && !status.data?.paused

  return (
    <Card className="space-y-3 text-sm">
      <PanelHeader title="Demonstration environment" />
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          tone={status.data?.demo_data ? 'success' : 'neutral'}
          label={status.data?.demo_data ? 'Demo data loaded' : 'No demo seed'}
        />
        {simOn ? (
          <StatusBadge tone={simActive ? 'warning' : 'neutral'} label={simActive ? 'Simulation on' : 'Simulation paused'} />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => seed.mutate()}>
          {seed.isPending ? 'Seeding…' : 'Load demo data'}
        </button>
        {!simOn ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => start.mutate()}>
            Start simulation
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => (status.data?.paused ? resume.mutate() : pause.mutate())}
            >
              {status.data?.paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => stop.mutate()}>
              Stop simulation
            </button>
          </>
        )}
      </div>
      {seed.data ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          Last seed: {seed.data.projects} projects · {seed.data.approvals} workloads · {seed.data.reservations} reservations
        </p>
      ) : null}
    </Card>
  )
}