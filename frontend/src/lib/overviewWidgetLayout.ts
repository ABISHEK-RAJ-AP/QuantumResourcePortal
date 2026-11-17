import type { WidgetItem } from '@/components/ui/draggable-widget-grid-layout'

const STORAGE_PREFIX = 'qrp-overview-widgets-v4'

export const DEFAULT_OVERVIEW_WIDGETS: WidgetItem[] = [
  { id: 'stages', size: 'wide', label: 'Request stages' },
  { id: 'quota', size: 'wide', label: 'Daily quota' },
  { id: 'alerts', size: 'wide', label: 'Alerts by backend' },
  { id: 'queue', size: 'lg', label: 'Review queue' },
  { id: 'dispatch', size: 'wide', label: 'Dispatch exceptions' },
  { id: 'decisions', size: 'wide', label: 'Recent decisions' },
]

const VALID_WIDGET_IDS = new Set(DEFAULT_OVERVIEW_WIDGETS.map((w) => w.id))

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
    if (!s?.id || !VALID_WIDGET_IDS.has(s.id)) continue
    const base = byId.get(s.id)
    if (!base) continue
    ordered.push({ ...base, size: s.size || base.size })
    byId.delete(s.id)
  }
  for (const rest of byId.values()) ordered.push(rest)
  return ordered.length > 0 ? ordered : defaults
}