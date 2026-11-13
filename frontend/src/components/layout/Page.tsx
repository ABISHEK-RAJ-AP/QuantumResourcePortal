import type { ReactNode } from 'react'

import type { Crumb } from '@/components/layout/Breadcrumbs'
import { StatusBadge, type StatusTone } from '@/components/status/StatusBadge'
import { WorkflowSteps, type WorkflowStep } from '@/components/workflow/WorkflowSteps'
import { useSetPageChrome } from '@/components/layout/page-context'
import { cn } from '@/lib/utils'

export function Page({
  eyebrow,
  title,
  description,
  crumbs,
  updatedAt,
  steps,
  stepIndex,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  crumbs?: Crumb[]
  /** Shown in shell header only — do not also render DataFreshness in the body. */
  updatedAt?: number
  steps?: WorkflowStep[]
  stepIndex?: number | null
  /** Primary work only (create / decide). Nav links belong in the quick-actions dock. */
  actions?: ReactNode
  children?: ReactNode
}) {
  useSetPageChrome({ eyebrow, title, description, crumbs, updatedAt })

  return (
    <div className="flex w-full max-w-none flex-col gap-4">
      {actions ? <div className="-mt-1 flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      {steps && steps.length > 0 ? (
        <section className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
          <WorkflowSteps steps={steps} current={stepIndex ?? null} />
        </section>
      ) : null}
      {children}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('surface-card', className)}>{children}</section>
  )
}

export function MetricTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: unknown
  hint?: string
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'critical'
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/20'
      : tone === 'success'
        ? 'border-success/25'
        : tone === 'warning'
          ? 'border-warning/30'
          : tone === 'critical'
            ? 'border-critical/30'
            : ''
  return (
    <Card className={cn('relative py-4', toneClass)}>
      <p className="label-quiet">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
        {value == null || value === '' ? '—' : String(value)}
      </p>
      {hint && <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{hint}</p>}
    </Card>
  )
}

export function PanelHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border/90 bg-gradient-to-b from-muted/35 to-muted/10 px-4 py-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        <div className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{body}</div>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function Notice({
  tone = 'critical',
  children,
  action,
}: {
  tone?: StatusTone
  children: ReactNode
  /** Optional control under the message (for example Retry on a failed query). */
  action?: ReactNode
}) {
  const shell =
    tone === 'critical'
      ? 'border-critical/25 bg-critical-soft/25'
      : tone === 'warning'
        ? 'border-warning/25 bg-warning-soft/30'
        : tone === 'success'
          ? 'border-success/20 bg-success-soft/25'
          : 'border-border bg-card'
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-card', shell)}>
      <StatusBadge
        tone={tone}
        label={tone === 'critical' ? 'Unavailable' : tone === 'warning' ? 'Attention' : 'Note'}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug text-muted-foreground">{children}</div>
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  )
}

/** Compact pulse bone for loading — used by QueryBody and detail pages. */
export function LoadingLine({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[4.5rem] animate-pulse rounded-xl bg-muted/80" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card p-3">
        <div className="mb-3 h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
      <Card className="space-y-3 lg:col-span-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted/80" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-9 animate-pulse rounded-lg bg-muted" />
      </Card>
      <span className="sr-only">Loading detail</span>
    </div>
  )
}

const STATE_TONE: Record<string, StatusTone> = {
  approved: 'success',
  active: 'success',
  ok: 'success',
  online: 'success',
  completed: 'success',
  optimal: 'success',
  healthy: 'success',
  running: 'success',
  degraded: 'warning',
  unavailable: 'critical',
  offline: 'critical',
  congested: 'critical',
  busy: 'warning',
  paused: 'warning',
  queued: 'warning',
  moderate: 'info',
  submitted_for_review: 'warning',
  in_review: 'warning',
  changes_requested: 'warning',
  pending_review: 'warning',
  maintenance: 'warning',
  rejected: 'critical',
  withdrawn: 'critical',
  suspended: 'critical',
  failed: 'critical',
  cancelled: 'critical',
  canceled: 'critical',
}

export function stateTone(state: string): StatusTone {
  return STATE_TONE[state] ?? 'neutral'
}

export function stateLabel(state: string) {
  return state.replaceAll('_', ' ')
}
