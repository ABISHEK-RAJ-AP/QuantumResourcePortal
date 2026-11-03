import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { StatusBadge } from '@/components/status/StatusBadge'
import { stateLabel, stateTone } from '@/components/layout/Page'
import { cn } from '@/lib/utils'

export type ReservationCalRow = Record<string, unknown>

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function buildGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isoDay(iso: unknown) {
  const raw = String(iso || '')
  if (!raw) return ''
  // Prefer calendar day in local timezone so holds align with the month grid.
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatWindow(iso: unknown) {
  const d = new Date(String(iso || ''))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function eventTitle(row: ReservationCalRow) {
  const resource = String(row.resource_ref || '').trim()
  const state = stateLabel(String(row.state || 'requested'))
  if (resource) return `${resource} · ${state}`
  return state
}

type DayEvent = {
  id: string
  title: string
  conflict: boolean
  row: ReservationCalRow
}

function groupByDate(rows: ReservationCalRow[]): Record<string, DayEvent[]> {
  const acc: Record<string, DayEvent[]> = {}
  for (const row of rows) {
    const key = isoDay(row.window_start)
    if (!key) continue
    const list = acc[key] ?? []
    list.push({
      id: String(row.reservation_id || `${key}-${list.length}`),
      title: eventTitle(row),
      conflict: Boolean(row.has_conflict),
      row,
    })
    acc[key] = list
  }
  return acc
}

/**
 * Month-grid reservation calendar — UI pattern from Cert Studio MonthCalendarGrid,
 * fields mapped to QRP holds (resource_ref, window, state, conflict, project).
 */
export function ReservationCalendar({
  rows,
  className,
  title = 'Hold calendar',
  onDaySelect,
}: {
  rows: ReservationCalRow[]
  className?: string
  title?: string
  /** Fires when a day is selected — Scheduling can prefill the window. */
  onDaySelect?: (dateStr: string, dayRows: ReservationCalRow[]) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const grid = useMemo(() => buildGrid(year, month), [year, month])
  const byDate = useMemo(() => groupByDate(rows), [rows])
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate())
  const monthLabel = `${MONTHS[month]} ${year}`
  const selectedEvents = selectedDate ? byDate[selectedDate] ?? [] : []

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  return (
    <div className={cn('qrp-cal-layout', className)}>
      <div className="qrp-cal-grid" role="region" aria-label={`${title}, ${monthLabel}`}>
        <div className="qrp-cal-grid__header">
          <h3 className="qrp-cal-grid__title">{title}</h3>
          <div className="qrp-cal-grid__nav">
            <button type="button" className="btn-ghost qrp-cal-grid__nav-btn" onClick={prevMonth} aria-label={`Previous month from ${monthLabel}`}>
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="qrp-cal-grid__month" aria-live="polite">
              {monthLabel}
            </span>
            <button type="button" className="btn-ghost qrp-cal-grid__nav-btn" onClick={nextMonth} aria-label={`Next month from ${monthLabel}`}>
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="qrp-cal-grid__weekdays">
          {DAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                'qrp-cal-grid__weekday',
                i === 0 && 'qrp-cal-grid__weekday--sun',
                i === 6 && 'qrp-cal-grid__weekday--sat',
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="qrp-cal-grid__cells" role="grid">
          {grid.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="qrp-cal-grid__cell qrp-cal-grid__cell--empty" aria-hidden />
            }
            const key = dateKey(year, month, day)
            const dayEvents = byDate[key] ?? []
            const isToday = key === todayStr
            const isSelected = selectedDate === key
            const hasConflict = dayEvents.some((e) => e.conflict)

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                className={cn(
                  'qrp-cal-grid__cell qrp-cal-grid__cell--interactive',
                  isToday && 'qrp-cal-grid__cell--today',
                  isSelected && 'qrp-cal-grid__cell--selected',
                  hasConflict && 'qrp-cal-grid__cell--conflict',
                )}
                onClick={() => {
                  setSelectedDate(key)
                  onDaySelect?.(
                    key,
                    dayEvents.map((e) => e.row),
                  )
                }}
                aria-label={`${MONTHS[month]} ${day}, ${year}. ${dayEvents.length} hold(s).`}
              >
                <span className="qrp-cal-grid__day-num">{day}</span>
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className={cn('qrp-cal-grid__event', ev.conflict && 'qrp-cal-grid__event--conflict')}
                    title={ev.title}
                  >
                    {ev.title}
                  </span>
                ))}
                {dayEvents.length > 3 ? (
                  <span className="qrp-cal-grid__event qrp-cal-grid__event--more">+{dayEvents.length - 3} more</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <aside className="qrp-cal-side" aria-label="Selected day holds">
        <h4 className="qrp-cal-side__heading">{selectedDate ? selectedDate : 'Select a day'}</h4>
        <p className="qrp-cal-side__hint">Governance holds only — not provider queue or live capacity.</p>
        {!selectedDate ? (
          <p className="text-sm text-muted-foreground">Click a day to list holds and (on Schedule) prefill the window.</p>
        ) : selectedEvents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            No holds on this day. Request a window if you need a governance hold.
          </p>
        ) : (
          <ul className="qrp-cal-side__list">
            {selectedEvents.map((ev) => {
              const row = ev.row
              return (
                <li key={ev.id} className={cn('qrp-cal-side__item', ev.conflict && 'qrp-cal-side__item--conflict')}>
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium break-all">{String(row.resource_ref || '—')}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatWindow(row.window_start)} → {formatWindow(row.window_end)}
                    </p>
                    {row.purpose ? <p className="text-sm text-muted-foreground">{String(row.purpose)}</p> : null}
                    {row.project_id ? (
                      <Link className="text-xs font-medium text-primary hover:underline" to={`/qrp/projects/${row.project_id}`}>
                        Project {String(row.project_id).slice(0, 12)}…
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge tone={stateTone(String(row.state || ''))} label={stateLabel(String(row.state || 'requested'))} />
                    {ev.conflict ? <StatusBadge tone="critical" label="Overlap" /> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </aside>
    </div>
  )
}
