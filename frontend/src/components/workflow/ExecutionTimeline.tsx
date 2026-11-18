import { formatDateTime } from '@/lib/display'
import { StatusBadge } from '@/components/status/StatusBadge'
import { stateLabel, stateTone } from '@/components/layout/Page'

type Event = { state?: string; at?: string; label?: string }

/** Dense Argo/OnDemand-style execution timeline from provider_job.timeline JSON. */
export function ExecutionTimeline({ events, emptyBody }: { events: Event[]; emptyBody?: string }) {
  if (!events.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyBody ?? 'No timeline events recorded for this job.'}
      </p>
    )
  }
  return (
    <ol className="relative border-s border-border/80 ps-4">
      {events.map((ev, i) => {
        const state = String(ev.state || ev.label || 'event')
        const at = ev.at ? formatDateTime(ev.at) : '—'
        return (
          <li key={`${state}-${ev.at ?? i}`} className="relative pb-4 last:pb-0">
            <span
              className="absolute -start-[5px] top-1.5 size-2 rounded-full bg-primary ring-2 ring-card"
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={stateTone(state.toLowerCase())} label={stateLabel(state)} />
              <time className="text-xs tabular-nums text-muted-foreground">{at}</time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}