import type { WidgetItem } from '@/components/ui/draggable-widget-grid-layout'

const STORAGE_PREFIX = 'qrp-overview-widgets-v1'

export const DEFAULT_OVERVIEW_WIDGETS: WidgetItem[] = [
  { id: 'kpis', size: 'wide', label: 'Operational summary' },
  { id: 'pipeline', size: 'wide', label: 'Lifecycle pipeline' },
  { id: 'actions', size: 'tall', label: 'Action centre' },
  { id: 'queue', size: 'wide', label: 'Recent reviews' },
  { id: 'activity', size: 'sm', label: 'Recent activity' },
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