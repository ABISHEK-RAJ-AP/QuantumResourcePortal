/** Deep links that honour project_id when list APIs support it. */

export function scopedApprovalsPath(projectId: string, filter?: string): string {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  if (filter && filter !== 'queue') params.set('filter', filter)
  const q = params.toString()
  return q ? `/qrp/approvals?${q}` : '/qrp/approvals'
}

export function scopedReservationsPath(projectId: string): string {
  if (!projectId) return '/qrp/reservations'
  return `/qrp/reservations?project_id=${encodeURIComponent(projectId)}`
}

export function scopedQuotasPath(projectId: string): string {
  if (!projectId) return '/qrp/quotas'
  return `/qrp/quotas?project_id=${encodeURIComponent(projectId)}`
}

export function scopedAuditPath(projectId: string): string {
  if (!projectId) return '/qrp/audit'
  return `/qrp/audit?project_id=${encodeURIComponent(projectId)}`
}