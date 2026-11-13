import { type ReactNode, useEffect, useId, useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'

import { Card, EmptyState, Notice, PanelHeader } from '@/components/layout/Page'
import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { chartHeightPx } from '@/lib/workspacePrefs'
import { cn } from '@/lib/utils'

export type ChartPanelState = 'ready' | 'loading' | 'empty' | 'error'

/** Chart surface with expand / size from workspace prefs and honest load states. */
export function ChartPanel({
  title,
  action,
  children,
  className,
  empty,
  state,
  emptyTitle,
  emptyBody,
  errorMessage,
  onRetry,
}: {
  title: string
  action?: ReactNode
  children: (height: number) => ReactNode
  className?: string
  /** Legacy: treat as empty when true (prefer `state`). */
  empty?: boolean
  state?: ChartPanelState
  emptyTitle?: string
  emptyBody?: string
  errorMessage?: string
  onRetry?: () => void
}) {
  const prefs = useWorkspacePrefs()
  const [expanded, setExpanded] = useState(prefs.chartsExpandedDefault)
  const titleId = useId()

  const resolved: ChartPanelState =
    state ?? (empty ? 'empty' : 'ready')

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const height = chartHeightPx(prefs.chartSize, false)
  const expandHeight = chartHeightPx(prefs.chartSize, true)
  const showExpand = resolved === 'ready'

  const stage = (h: number) => {
    if (resolved === 'loading') {
      return (
        <div className="flex h-full min-h-[7rem] flex-col justify-center gap-2" aria-busy="true" aria-live="polite">
          <div className="h-full min-h-[7rem] animate-pulse rounded-lg bg-muted/80" />
        </div>
      )
    }
    if (resolved === 'error') {
      return (
        <Notice
          action={
            onRetry ? (
              <button type="button" className="btn-secondary" onClick={onRetry}>
                Retry
              </button>
            ) : undefined
          }
        >
          {errorMessage || 'Chart unavailable'}
        </Notice>
      )
    }
    if (resolved === 'empty') {
      return (
        <EmptyState
          title={emptyTitle || 'No chart data'}
          body={emptyBody || 'Nothing to plot for this filter.'}
        />
      )
    }
    return children(h)
  }

  return (
    <>
      <Card className={cn('space-y-2', className)}>
        <PanelHeader
          title={title}
          action={
            <span className="flex flex-wrap items-center gap-1">
              {action}
              {showExpand ? (
                <button
                  type="button"
                  className="btn-ghost grid size-8 place-items-center p-0"
                  aria-label={`Expand chart: ${title}`}
                  title="Expand chart"
                  onClick={() => setExpanded(true)}
                >
                  <Maximize2 className="size-3.5" />
                </button>
              ) : null}
            </span>
          }
        />
        <div
          style={{
            height: resolved === 'ready' ? height : undefined,
            minHeight: resolved === 'ready' ? height : undefined,
          }}
        >
          {stage(height)}
        </div>
      </Card>

      {expanded && resolved === 'ready' ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost grid size-9 place-items-center p-0"
                  aria-label="Minimize"
                  onClick={() => setExpanded(false)}
                >
                  <Minimize2 className="size-4" />
                </button>
                <button
                  type="button"
                  className="btn-ghost grid size-9 place-items-center p-0"
                  aria-label="Close expanded chart"
                  onClick={() => setExpanded(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1" style={{ height: expandHeight }}>
              {children(expandHeight)}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
