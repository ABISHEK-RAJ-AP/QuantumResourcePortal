import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { TableCaptionProvider } from '@/components/data/table-caption-context'
import type { Crumb } from '@/components/layout/Breadcrumbs'
import type { StatusTone } from '@/components/status/StatusBadge'
import { WorkflowGuide } from '@/components/workflow/WorkflowGuide'
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
  workflowGuide,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  crumbs?: Crumb[]
  /** Shown in shell header only — do not also render DataFreshness in the body. */
  updatedAt?: number
  /** Contextual lifecycle rail only (approval detail, asset lifecycle, incident record). Omit on list/hub pages — use breadcrumbs instead. */
  steps?: WorkflowStep[]
  stepIndex?: number | null
  /** Role-aware detail card under the step trail (uses active step metadata). */
  workflowGuide?: boolean
  /** Primary work only (create / decide). Nav links belong in the quick-actions dock. */
  actions?: ReactNode
  children?: ReactNode
}) {
  useSetPageChrome({ eyebrow, title, description, crumbs, updatedAt, actions })

  const activeStep =
    workflowGuide && steps && steps.length > 0 && stepIndex != null && stepIndex >= 0
      ? steps[Math.min(stepIndex, steps.length - 1)]
      : undefined

  return (
    <div className="flex w-full max-w-none flex-col gap-3">
      {steps && steps.length > 0 ? (
        <section className="craft-card rounded-xl border border-border bg-card px-4 py-3 shadow-card">
          <WorkflowSteps steps={steps} current={stepIndex ?? null} />
        </section>
      ) : null}
      {workflowGuide && activeStep ? (
        <WorkflowGuide step={activeStep} defaultOpen={false} />
      ) : null}
      {children}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('craft-card rounded-xl border border-border bg-card p-4 shadow-card', className)}>{children}</section>
  )
}

export function MetricTile({
  label,
  value,
  hint,
  tone = 'neutral',
  compact = false,
  className,
}: {
  label: string
  value: unknown
  hint?: string
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'critical'
  compact?: boolean
  className?: string
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/30 bg-primary/[0.04]'
      : tone === 'success'
        ? 'border-success/25 bg-success-soft/40'
        : tone === 'warning'
          ? 'border-warning/25 bg-warning-soft/35'
          : tone === 'critical'
            ? 'border-critical/25 bg-critical-soft/35'
            : ''
  return (
    <Card
      className={cn(
        'metric-tile relative overflow-hidden',
        compact ? 'max-h-[4.75rem] py-2.5' : 'py-4',
        toneClass,
        className,
      )}
    >
      <p className={cn('acr font-semibold text-muted-foreground', compact ? 'text-[10px]' : 'text-[11px]')}>
        {label}
      </p>
      <p className={cn('font-semibold tracking-tight tabular-nums', compact ? 'mt-0.5 text-xl leading-none' : 'mt-2 text-3xl')}>
        {value == null || value === '' ? '—' : String(value)}
      </p>
      {hint && !compact ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}

export type RelatedNavItem = { to: string; label: string; hint?: string }

/** TeleScope-style related pages — text links, not secondary button rows. */
export function RelatedNav({ items, className }: { items: RelatedNavItem[]; className?: string }) {
  if (!items.length) return null
  return (
    <nav className={cn('page-related-nav', className)} aria-label="Related pages">
      <span className="page-related-nav__label">Related</span>
      <ul className="page-related-nav__list">
        {items.map((item) => (
          <li key={item.to}>
            <Link className="fs-link" to={item.to} title={item.hint}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PanelHeader({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  /** When set, nested tables inherit this caption unless they pass their own. */
  children?: ReactNode
}) {
  const head = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="type-section-title type-title-clamp">{title}</h2>
      {action}
    </div>
  )
  if (children == null) return head
  return (
    <TableCaptionProvider title={title}>
      {head}
      {children}
    </TableCaptionProvider>
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
  const showBody =
    body != null &&
    body !== '' &&
    body !== '—' &&
    !(typeof body === 'string' && body.trim() === '—')
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border bg-muted/15 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {showBody ? <div className="mt-0.5 text-sm leading-snug text-muted-foreground">{body}</div> : null}
      </div>
      {action}
    </div>
  )
}

export function Notice({
  tone = 'critical',
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 text-sm text-muted-foreground',
        tone === 'critical'
          ? 'border-critical/30 bg-critical-soft/25 text-foreground'
          : tone === 'warning'
            ? 'border-warning/30 bg-warning-soft/20'
            : 'border-border bg-muted/15',
        className,
      )}
    >
      {children}
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
