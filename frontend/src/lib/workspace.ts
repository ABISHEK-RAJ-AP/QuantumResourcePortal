export type WorkspaceType = 'researcher' | 'admin' | 'provider'

const ADMIN_ROLES = new Set([
  'PLATFORM_ADMIN',
  'OPERATOR',
  'QUOTA_APPROVER',
  'AUDITOR',
  'RESOURCE_MANAGER',
])

/** Primary role → workspace shell (sidebar + home priorities). */
export function detectWorkspace(roles: string[] | undefined): WorkspaceType {
  const primary = roles?.[0]?.toUpperCase() ?? ''
  if (primary === 'PROVIDER_ADMIN') return 'provider'
  if (ADMIN_ROLES.has(primary)) return 'admin'
  return 'researcher'
}