import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchDemoSimulationStatus,
  pauseDemoSimulation,
  resumeDemoSimulation,
  startDemoSimulation,
  stopDemoSimulation,
  tickDemoSimulation,
} from '@/api/demoSimulation'
import { seedPortalDemo } from '@/api/seedDemo'
import { Card, Notice, PanelHeader } from '@/components/layout/Page'
import { demoActionsAllowed } from '@/lib/demo'

/** Lab admin — PostgreSQL seed + simulation controls (Settings). */
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
  const tick = useMutation({ mutationFn: tickDemoSimulation, onSuccess: invalidate })

  if (!demoActionsAllowed) return null

  const busy =
    seed.isPending || start.isPending || pause.isPending || resume.isPending || stop.isPending || tick.isPending

  return (
    <Card className="space-y-3 text-sm">
      <PanelHeader title="Demonstration environment" />
      <Notice tone="warning">
        <p className="font-medium text-foreground">Development only</p>
        <p className="mt-1 text-muted-foreground">
          Loads labelled <code className="text-xs">[DEMO]</code> rows into PostgreSQL and optionally simulates queue/job
          movement. Not live provider telemetry.
        </p>
      </Notice>
      <QueryLine query={status} label="Status" />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => seed.mutate()}>
          {seed.isPending ? 'Seeding…' : 'Load demo data'}
        </button>
        {!status.data?.enabled ? (
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
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => tick.mutate()}>
              Advance tick
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => stop.mutate()}>
              Stop simulation
            </button>
          </>
        )}
      </div>
      {seed.data ? (
        <p className="text-xs text-muted-foreground">
          Last seed ({seed.data.source ?? 'backend'}): {seed.data.projects} projects · {seed.data.approvals} workloads ·{' '}
          {seed.data.reservations} reservations
          {seed.data.errors.length ? ` · ${seed.data.errors.length} warnings` : ''}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        CLI: <code className="text-xs">make seed-demo</code> · see <code className="text-xs">docs/development/QRP_DEMO_ENVIRONMENT.md</code>
      </p>
    </Card>
  )
}

function QueryLine({
  query,
  label,
}: {
  query: { isPending: boolean; isError: boolean; data?: { demo_data?: boolean; enabled?: boolean; paused?: boolean; tick_count?: number } }
  label: string
}) {
  if (query.isPending) return <p className="text-muted-foreground">{label}: loading…</p>
  if (query.isError) return <p className="text-muted-foreground">{label}: unavailable outside lab session</p>
  const active = query.data?.enabled && !query.data?.paused
  return (
    <p>
      <span className="font-medium">{label}:</span>{' '}
      {query.data?.demo_data ? 'Demo data present' : 'No demo seed marker'}
      {active ? ' · simulation running' : query.data?.enabled ? ' · simulation paused' : ''}
      {typeof query.data?.tick_count === 'number' ? ` · ticks ${query.data.tick_count}` : ''}
    </p>
  )
}