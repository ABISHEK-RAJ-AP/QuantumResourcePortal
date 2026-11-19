import type { ReactNode } from 'react'

import { formatApiError, apiMessage } from '@/lib/apiMessage'
import { EmptyState, LoadingLine, Notice } from '@/components/layout/Page'

export function DataState({
  pending,
  error,
  onRetry,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyBody,
  notReportedTitle = 'Data not available',
  children,
  compactLoading,
}: {
  pending?: boolean
  error?: unknown
  onRetry?: () => void
  empty?: boolean
  emptyTitle?: string
  emptyBody?: ReactNode
  /** Shown for 404 / missing module endpoints instead of a generic error tone. */
  notReportedTitle?: string
  children: ReactNode
  compactLoading?: boolean
}) {
  if (pending) {
    return compactLoading ? (
      <p className="p-4 text-sm text-muted-foreground" aria-busy="true">
        Loading…
      </p>
    ) : (
      <LoadingLine />
    )
  }
  if (error) {
    const info = apiMessage(error)
    const tone = info.forbidden ? ('warning' as const) : ('critical' as const)
    const title = info.forbidden ? 'Access denied' : info.notFound ? notReportedTitle : 'Unavailable'
    return (
      <Notice tone={tone} className="w-full max-w-none text-left">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-pretty">{formatApiError(error)}</p>
        {onRetry ? (
          <button type="button" className="btn-ghost mt-3 text-sm" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </Notice>
    )
  }
  if (empty) {
    return <EmptyState title={emptyTitle} body={emptyBody} />
  }
  return children
}