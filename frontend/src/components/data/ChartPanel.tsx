import { type ReactNode, useEffect, useId, useState } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'

import { Card, PanelHeader } from '@/components/layout/Page'
import { useWorkspacePrefs } from '@/hooks/useWorkspacePrefs'
import { chartHeightPx } from '@/lib/workspacePrefs'
import { cn } from '@/lib/utils'

/** Chart surface with expand / size from workspace prefs. */
export function ChartPanel({
  title,
  action,
  children,
  className,
  empty,
}: {
  title: string
  action?: ReactNode
  children: (height: number) => ReactNode
  className?: string
  empty?: boolean
}) {
  const prefs = useWorkspacePrefs()
  const [expanded, setExpanded] = useState(prefs.chartsExpandedDefault)
  const titleId = useId()

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

  return (
    <>
      <Card className={cn('space-y-2', className)}>
        <PanelHeader
          title={title}
          action={
            <span className="flex flex-wrap items-center gap-1">
              {action}
              {!empty ? (
                <button
                  type="button"
                  className="btn-ghost grid size-8 place-items-center p-0"
                  aria-label={expanded ? 'Collapse chart' : 'Expand chart'}
                  title="Expand chart"
                  onClick={() => setExpanded(true)}
                >
                  <Maximize2 className="size-3.5" />
                </button>
              ) : null}
            </span>
          }
        />
        <div style={{ height: empty ? undefined : height, minHeight: empty ? undefined : height }}>{children(height)}</div>
      </Card>

      {expanded ? (
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
