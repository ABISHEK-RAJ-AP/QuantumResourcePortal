import type { WidgetItem } from '@/components/ui/draggable-widget-grid-layout'

const STORAGE_PREFIX = 'qrp-overview-widgets-v2'

export const DEFAULT_OVERVIEW_WIDGETS: WidgetItem[] = [
  { id: 'kpis', size: 'wide', label: 'Operational summary' },
  { id: 'stages', size: 'wide', label: 'Request stages' },
  { id: 'quota', size: 'sm', label: 'Daily quota' },
  { id: 'alerts', size: 'sm', label: 'Alerts by backend' },
  { id: 'fleet', size: 'wide', label: 'Fleet posture' },
  { id: 'queue', size: 'lg', label: 'Review queue' },
  { id: 'dispatch', size: 'wide', label: 'Dispatch exceptions' },
  { id: 'decisions', size: 'wide', label: 'Recent decisions' },
  { id: 'actions', size: 'tall', label: 'Shortcuts' },
]

export function readWidgetLayout(lens: string): WidgetItem[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${lens}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((w): w is WidgetItem => Boolean(w && typeof w === 'object' && 'id' in w && 'size' in w))
  } catch {
    return null
  }
}

export function writeWidgetLayout(lens: string, items: WidgetItem[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${lens}`, JSON.stringify(items))
  } catch {
    /* quota / private mode */
  }
}

export function mergeSavedOrder(defaults: WidgetItem[], saved: WidgetItem[] | null): WidgetItem[] {
  if (!saved?.length) return defaults
  const byId = new Map(defaults.map((d) => [d.id, d]))
  const ordered: WidgetItem[] = []
  for (const s of saved) {
    const base = byId.get(s.id)
    if (!base) continue
    ordered.push({ ...base, size: s.size || base.size })
    byId.delete(s.id)
  }
  for (const rest of byId.values()) ordered.push(rest)
  return ordered
}