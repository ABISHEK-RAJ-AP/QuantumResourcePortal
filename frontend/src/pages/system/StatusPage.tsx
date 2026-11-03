import { useQuery } from '@tanstack/react-query'
import { Activity, Database, GitBranch, RefreshCw, Settings2, Server, type LucideIcon } from 'lucide-react'

import { ApiError } from '@/api/client'
import { fetchLiveness, fetchReadiness, systemKeys, type Check } from '@/api/system'
import { LogoMark } from '@/components/brand/LogoMark'
import { useSetPageChrome } from '@/components/layout/page-context'
import { StatusBadge } from '@/components/status/StatusBadge'
import { cn } from '@/lib/utils'

const CHECK_META: Record<string, { label: string; icon: LucideIcon }> = {
  configuration: { label: 'Configuration', icon: Settings2 },
  database: { label: 'PostgreSQL database', icon: Database },
  migrations: { label: 'Schema migrations', icon: GitBranch },
}

const REFRESH_MS = 15_000

function formatTime(iso: string | undefined) {
  if (!iso) return 'Unavailable'
  const date = new Date(iso)
  return `${date.toLocaleTimeString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-6 shadow-card', className)}>
      {children}
    </section>
  )
}

function CheckRow({ name, check }: { name: string; check: Check }) {
  const meta = CHECK_META[name] ?? { label: name, icon: Server }
  const Icon = meta.icon
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon aria-hidden="true" className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{check.detail}</p>
      </div>
      <StatusBadge tone={check.ok ? 'success' : 'critical'} label={check.ok ? 'OK' : 'Failing'} />
    </li>
  )
}

/**
 * Platform status (development diagnostics): proves the browser → Vite proxy → FastAPI →
 * PostgreSQL path works. Moves under Settings → System in Phase 7.
 */
function StatusRefresh({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-card transition hover:bg-accent hover:text-accent-foreground"
    >
      <RefreshCw aria-hidden="true" className={cn('size-4', refreshing && 'animate-spin')} />
      Refresh
    </button>
  )
}

export function StatusPage({ framed = false }: { framed?: boolean }) {
  const liveness = useQuery({
    queryKey: systemKeys.liveness,
    queryFn: fetchLiveness,
    refetchInterval: REFRESH_MS,
  })
  const readiness = useQuery({
    queryKey: systemKeys.readiness,
    queryFn: fetchReadiness,
    refetchInterval: REFRESH_MS,
  })

  const refreshing = liveness.isFetching || readiness.isFetching
  const apiError = liveness.error instanceof ApiError ? liveness.error : null
  const ready = readiness.data?.status === 'ready'
  const refresh = () => {
    void liveness.refetch()
    void readiness.refetch()
  }

  useSetPageChrome(
    framed
      ? {
          eyebrow: 'Operations',
          title: 'Platform status',
          description: 'Browser → API → database path for this portal session.',
        }
      : {},
  )

  return (
    <main className={framed ? 'mx-auto flex max-w-4xl flex-col gap-6' : 'mx-auto flex min-h-svh max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6'}>
      {framed ? (
        <div className="flex justify-end">
          <StatusRefresh refreshing={refreshing} onRefresh={refresh} />
        </div>
      ) : (
        <header className="flex flex-wrap items-center gap-4">
          <LogoMark className="h-11 w-auto" />
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Quantum Resource Portal
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Platform status</h1>
          </div>
          <StatusRefresh refreshing={refreshing} onRefresh={refresh} />
        </header>
      )}

      {apiError ? (
        <Card className="border-critical/30">
          <div className="flex items-start gap-4">
            <StatusBadge tone="critical" label="Unreachable" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">{apiError.title}</p>
              <p className="text-muted-foreground">
                Start the backend (<code className="font-mono">make dev-api</code>) and press Refresh.
              </p>
              {apiError.correlationId && (
                <p className="font-mono text-xs text-muted-foreground">Ref {apiError.correlationId}</p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="relative overflow-hidden">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-(image:--brand-gradient)" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity aria-hidden="true" className="size-4" /> API liveness
            </div>
            <div className="mt-3">
              {liveness.isPending ? (
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              ) : (
                <StatusBadge tone="success" label="Alive" />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Server time {formatTime(liveness.data?.time)}</p>
          </Card>
          <Card>
            <div className="text-sm text-muted-foreground">Readiness</div>
            <div className="mt-3">
              {readiness.isPending ? (
                <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              ) : (
                <StatusBadge tone={ready ? 'success' : 'critical'} label={ready ? 'Ready' : 'Not ready'} />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Checked {formatTime(readiness.data?.time)}
            </p>
          </Card>
          <Card>
            <div className="text-sm text-muted-foreground">Build</div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {liveness.data?.version ?? '—'}
            </p>
            <div className="mt-2">
              <StatusBadge
                tone="info"
                label={`${(readiness.data?.environment ?? 'unknown').toUpperCase()} profile`}
              />
            </div>
          </Card>
        </div>
      )}

      <Card>
        <h2 className="text-base font-semibold">Readiness checks</h2>
        <p className="text-sm text-muted-foreground">
          From <code className="font-mono text-xs">GET /readyz</code> · refreshes every 15 seconds
        </p>
        {readiness.data ? (
          <ul className="mt-2 divide-y divide-border">
            {Object.entries(readiness.data.checks).map(([name, check]) => (
              <CheckRow key={name} name={name} check={check} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {readiness.isPending ? 'Loading…' : 'Readiness information is unavailable.'}
          </p>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        API documentation:{' '}
        <a className="font-medium text-primary underline-offset-4 hover:underline" href="/api/v1/docs">
          /api/v1/docs
        </a>
      </p>
    </main>
  )
}
