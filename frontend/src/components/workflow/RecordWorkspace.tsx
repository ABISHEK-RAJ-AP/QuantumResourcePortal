import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'
import { Card, PanelHeader } from '@/components/layout/Page'

export type RecordTab = {
  id: string
  label: string
  count?: number | string
}

export type RelatedLink = {
  to: string
  label: string
  hint?: string
}

export type NextAction = {
  title: string
  body: string
  primary?: { to?: string; label: string; onClick?: () => void; disabled?: boolean }
  secondary?: { to?: string; label: string; onClick?: () => void }
  blockers?: string[]
}

/** Shared record detail shell: tabs + next-action / related side panel. */
export function RecordWorkspace({
  tabs,
  activeTab,
  onTabChange,
  nextAction,
  related,
  children,
  sideExtra,
}: {
  tabs: RecordTab[]
  activeTab: string
  onTabChange: (id: string) => void
  nextAction?: NextAction
  related?: RelatedLink[]
  children: ReactNode
  sideExtra?: ReactNode
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="min-w-0 space-y-4">
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1"
          role="tablist"
          aria-label="Record sections"
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  selected ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
                {tab.count != null && tab.count !== '' ? (
                  <span className={cn('ms-1.5 tabular-nums', selected ? 'opacity-90' : 'opacity-70')}>{tab.count}</span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div role="tabpanel">{children}</div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        {nextAction ? (
          <Card className="space-y-3">
            <PanelHeader title="Next action" />
            <p className="text-sm font-semibold">{nextAction.title}</p>
            <p className="text-sm text-muted-foreground">{nextAction.body}</p>
            {nextAction.blockers && nextAction.blockers.length > 0 ? (
              <ul className="space-y-1 text-xs text-critical">
                {nextAction.blockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {nextAction.primary?.to ? (
                <Link
                  className={cn('btn-primary', nextAction.primary.disabled && 'pointer-events-none opacity-50')}
                  to={nextAction.primary.to}
                >
                  {nextAction.primary.label}
                </Link>
              ) : nextAction.primary ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={nextAction.primary.disabled}
                  onClick={nextAction.primary.onClick}
                >
                  {nextAction.primary.label}
                </button>
              ) : null}
              {nextAction.secondary?.to ? (
                <Link className="btn-ghost" to={nextAction.secondary.to}>
                  {nextAction.secondary.label}
                </Link>
              ) : nextAction.secondary ? (
                <button type="button" className="btn-ghost" onClick={nextAction.secondary.onClick}>
                  {nextAction.secondary.label}
                </button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {related && related.length > 0 ? (
          <Card className="space-y-2">
            <PanelHeader title="Related records" />
            <ul className="space-y-1">
              {related.map((item) => (
                <li key={`${item.to}-${item.label}`}>
                  <Link
                    className="flex flex-col rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                    to={item.to}
                  >
                    <span className="font-medium text-primary">{item.label}</span>
                    {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {sideExtra}
      </aside>
    </div>
  )
}
