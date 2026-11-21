export type DispatchRow = Record<string, unknown>

export const RECON_FILTERS = [
  { id: 'unresolved', label: 'Needs reconcile' },
  { id: 'all', label: 'All' },
  { id: 'dispatch_confirmed', label: 'Confirmed' },
  { id: 'dispatch_failed', label: 'Failed' },
  { id: 'dispatch_unresolved', label: 'Unresolved' },
  { id: 'dispatch_authorized', label: 'Authorized' },
] as const

export function needsReconcile(row: DispatchRow) {
  const state = String(row.dispatch_state || '')
  return state === 'dispatch_unresolved' || state === 'dispatch_authorized'
}