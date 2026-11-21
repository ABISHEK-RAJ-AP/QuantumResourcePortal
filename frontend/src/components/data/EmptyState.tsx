import type { ReactNode } from 'react'
import { AlertCircle, FilterX, Inbox, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

export type EmptyStateType = 'first-time' | 'filtered' | 'error' | 'loading'

export interface EmptyStateProps {
  type?: EmptyStateType
  title: string
  description?: ReactNode
  /** @deprecated Use `description` */
  body?: ReactNode
  action?: ReactNode
  onRetry?: () => void
  lastUpdated?: string
  className?: string
}

const ICONS = {
  'first-time': Inbox,
  filtered: FilterX,
  error: AlertCircle,
  loading: Loader2,
} as const

export function EmptyState({
  type = 'first-time',
  title,
  description,
  body,
  action,
  onRetry,
  lastUpdated,
  className,
}: EmptyStateProps) {
  const copy = description ?? body
  const showBody =
    copy != null &&
    copy !== '' &&
    copy !== '—' &&
    !(typeof copy === 'string' && copy.trim() === '—')
  const Icon = ICONS[type]
  const isLoading = type === 'loading'

  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-muted/15 px-4 py-4 sm:px-5',
        className,
      )}
      aria-busy={isLoading}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground',
            isLoading && 'text-primary',
          )}
          aria-hidden
        >
          <Icon className={cn('size-4', isLoading && 'animate-spin')} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="type-body-small font-semibold leading-snug text-foreground">{title}</p>
          {showBody ? <div className="type-body-small mt-1 text-muted-foreground">{copy}</div> : null}
          {lastUpdated ? (
            <p className="type-caption mt-2 normal-case tracking-normal text-muted-foreground">
              Last updated {lastUpdated}
            </p>
          ) : null}
        </div>
      </div>
      {action}
      {onRetry ? (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}