import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { TableCaptionProvider } from '@/components/data/table-caption-context'
import type { Crumb } from '@/components/layout/Breadcrumbs'
import type { StatusTone } from '@/components/status/StatusBadge'
import { WorkflowGuide } from '@/components/workflow/WorkflowGuide'
import { WorkflowSteps, type WorkflowStep } from '@/components/workflow/WorkflowSteps'
import { useSetPageChrome } from '@/components/layout/page-context'
import { InfoTip } from '@/components/ui/InfoTip'
import { cn } from '@/lib/utils'

export function Page({
  eyebrow,
  title,
  description,
  descriptionHelp,
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
  descriptionHelp?: ReactNode
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
  useSetPageChrome({ eyebrow, title, description, descriptionHelp, crumbs, updatedAt, actions })

  const activeStep =
    workflowGuide && steps && steps.length > 0 && stepIndex != null && stepIndex >= 0
      ? steps[Math.min(stepIndex, steps.length - 1)]
      : undefined

  return (
    <div className="page-stack flex w-full flex-col gap-[var(--section-gap)]">
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
  return <section className={cn('craft-card rounded-xl border border-border bg-card p-5 sm:p-6', className)}>{children}</section>
}

export function MetricTile({
  label,
  value,
  hint,
  labelTip,
  tone = 'neutral',
  compact = false,
  to,
  onClick,
  className,
}: {
  label: string
  value: unknown
  hint?: string
  /** Detail for the label — InfoTip beside the label (hint stays one short line under the value). */
  labelTip?: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'critical'
  compact?: boolean
  /** When set, tile is a full-surface link (keyboard + pointer). */
  to?: string
  onClick?: () => void
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
  const shellClass = cn(
    'craft-card metric-tile relative block w-full overflow-hidden rounded-xl border border-border bg-card',
    compact ? 'min-h-[5.5rem] px-4 py-3 sm:px-5' : 'px-5 py-4 sm:px-6 sm:py-5',
    (to || onClick) &&
      'cursor-pointer transition-[border-color,box-shadow,transform] duration-150 hover:border-primary/35 hover:shadow-md hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/55',
    toneClass,
    className,
  )
  const body = (
    <>
      <p className={cn('acr font-semibold text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
        <span className="inline-flex items-center gap-0.5">
          {label}
          {labelTip ? (
            <InfoTip label={`About ${label}`} className="-my-1">
              {labelTip}
            </InfoTip>
          ) : null}
        </span>
      </p>
      <p
        className={cn(
          'font-semibold tracking-tight tabular-nums text-foreground',
          compact ? 'mt-1 text-2xl leading-none' : 'mt-2 text-3xl sm:text-[2rem]',
        )}
      >
        {value == null || value === '' ? '—' : String(value)}
      </p>
      {hint && !compact ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  )
  const aria = `${label}: ${value == null || value === '' ? 'no value' : String(value)}`
  if (to) {
    return (
      <Link to={to} className={cn(shellClass, 'text-inherit no-underline')} aria-label={aria}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cn(shellClass, 'text-start')} onClick={onClick} aria-label={aria}>
        {body}
      </button>
    )
  }
  return <section className={shellClass}>{body}</section>
}

export type RelatedNavItem = { to: string; label: string; hint?: string }

/** Retired — cross-page related links removed from workspace chrome. */
export function RelatedNav(_props: { items: RelatedNavItem[]; className?: string }) {
  return null
}

export function PanelHeader({
  title,
  action,
  tip,
  children,
}: {
  title: string
  action?: ReactNode
  /** Optional detail beside the section title (InfoTip). */
  tip?: ReactNode
  /** When set, nested tables inherit this caption unless they pass their own. */
  children?: ReactNode
}) {
  const head = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className="type-section-title type-title-clamp">{title}</h2>
        {tip ? (
          <InfoTip label={title} className="-my-0.5 shrink-0">
            {tip}
          </InfoTip>
        ) : null}
      </div>
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

export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  badge?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="type-page-title type-trim">{title}</h2>
          {badge}
        </div>
        {description ? <p className="qrp-page-desc type-desc-clamp mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export { EmptyState, type EmptyStateProps, type EmptyStateType } from '@/components/data/EmptyState'

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
  submitted_for_review: 'info',
  in_review: 'warning',
  changes_requested: 'warning',
  pending_review: 'warning',
  maintenance: 'warning',
  rejected: 'critical',
  withdrawn: 'neutral',
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
