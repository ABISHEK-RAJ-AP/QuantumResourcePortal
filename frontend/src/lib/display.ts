/** Human-readable labels for portal enums and identifiers. */

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Platform admin',
  TENANT_ADMIN: 'Institution admin',
  FACILITY_ADMIN: 'Facility admin',
  RESEARCHER: 'Researcher',
  REVIEWER: 'Reviewer',
  AUDITOR: 'Auditor',
  OPERATOR: 'Operator',
  QUANTUMOPS: 'Operator',
}

export function formatRole(code: string | undefined | null): string {
  if (!code) return 'Operator'
  const key = code.trim().toUpperCase().replace(/\s+/g, '_')
  if (ROLE_LABELS[key]) return ROLE_LABELS[key]
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const STATE_LABELS: Record<string, string> = {
  APPROVAL_DECIDED: 'Approval decided',
  IN_REVIEW: 'In review',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  dispatch_unresolved: 'Needs reconcile',
  dispatch_confirmed: 'Confirmed',
  dispatch_failed: 'Failed',
  dispatch_authorized: 'Authorized',
}

export function formatEnum(raw: string | undefined | null): string {
  if (!raw) return '—'
  const key = String(raw)
  if (STATE_LABELS[key]) return STATE_LABELS[key]
  if (STATE_LABELS[key.toLowerCase()]) return STATE_LABELS[key.toLowerCase()]
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Prefer a display name; never show a raw ULID as the primary username. */
export function formatPrincipalId(id: string | undefined | null, role?: string): string {
  if (!id) return 'Signed in'
  if (/^usr_[a-z0-9]+$/i.test(id) || id.length > 24) {
    return role ? formatRole(role) : 'Account'
  }
  return id
}

export function formatDateTime(iso: unknown, opts?: Intl.DateTimeFormatOptions): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, opts ?? { dateStyle: 'medium', timeStyle: 'short' })
}