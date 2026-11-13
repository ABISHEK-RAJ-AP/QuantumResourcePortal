/**
 * Typed client for the QRP RBAC backend (RBAC-4/5 endpoints). Same-origin; the session cookie and
 * CSRF token are handled by `api/client.ts`. Everything here maps 1:1 to a FastAPI route.
 */
import { apiGet, apiRequest } from '@/api/client'

const BASE = '/api/v1'

export interface Me {
  authenticated: boolean
  principal_id: string
  tenant_id: string
  roles: string[]
  permissions: string[]
}

export interface Grant {
  permission: string
  scope_type: 'TENANT' | 'PROJECT' | 'PROVIDER'
  scope_id: string | null
}

export interface NavItem {
  label: string
  route: string
  required_permission: string | null
}

export interface Role {
  role_id: string
  code: string
  name: string
  description: string
  assignable_scope: 'TENANT' | 'PROJECT' | 'PROVIDER'
  is_system: boolean
  status: 'ACTIVE' | 'INACTIVE'
  row_version: number
  permission_count?: number
  user_count?: number
  permissions?: string[]
}

export interface Permission {
  code: string
  module: string
  action: string
  name: string
  is_privileged: boolean
  roles: string[] | null
}

export interface AppUser {
  user_id: string
  username: string
  display_name: string
  email: string | null
  status: string
  mfa_enrolled?: boolean
}

export interface Membership {
  membership_id: string
  principal_id: string
  username: string
  role: string
  scope_type: string
  scope_id: string | null
  granted_at?: string
}

export interface EffectivePermissions {
  user_id: string
  username: string
  permissions: string[]
  grants: Grant[]
}

// ---- session / identity -------------------------------------------------------------------------

export const getMe = () => apiGet<Me>(`${BASE}/me`)
export const getNavigation = () => apiGet<{ items: NavItem[] }>(`${BASE}/me/navigation`)
export const getMyGrants = () =>
  apiGet<{ permissions: string[]; grants: Grant[] }>(`${BASE}/me/permissions`)
export const getCsrf = () => apiGet<{ csrf_token: string }>(`${BASE}/auth/csrf`)

export async function login(
  username: string,
  password: string,
  captcha?: { captcha_id: string; captcha_code: string },
) {
  const body: Record<string, string> = { username, password }
  if (captcha?.captcha_id && captcha.captcha_code) {
    body.captcha_id = captcha.captcha_id
    body.captcha_code = captcha.captcha_code
  }
  const res = await apiRequest<{ status: string; principal: Me; csrf_token: string }>(
    `${BASE}/auth/login`,
    { method: 'POST', json: body },
  )
  return res.data
}

export const logout = () => apiRequest(`${BASE}/auth/logout`, { method: 'POST' })

// ---- roles --------------------------------------------------------------------------------------

export const listRoles = () => apiGet<{ items: Role[] }>(`${BASE}/admin/roles`).then((r) => r.items)
export const getRole = (roleId: string) => apiGet<Role>(`${BASE}/admin/roles/${roleId}`)
export const createRole = (body: {
  code: string
  name: string
  description?: string
  assignable_scope: string
  permission_codes: string[]
}) => apiRequest<Role>(`${BASE}/admin/roles`, { method: 'POST', json: body }).then((r) => r.data)

export const updateRole = (roleId: string, body: { name?: string; description?: string }, rowVersion?: number) =>
  apiRequest<Role>(`${BASE}/admin/roles/${roleId}`, {
    method: 'PATCH',
    json: body,
    headers: rowVersion != null ? { 'If-Match': String(rowVersion) } : undefined,
  }).then((r) => r.data)

export const setRolePermissions = (roleId: string, permissionCodes: string[], rowVersion?: number) =>
  apiRequest<Role>(`${BASE}/admin/roles/${roleId}/permissions`, {
    method: 'PUT',
    json: { permission_codes: permissionCodes },
    headers: rowVersion != null ? { 'If-Match': String(rowVersion) } : undefined,
  }).then((r) => r.data)

export const setRoleActive = (roleId: string, active: boolean) =>
  apiRequest<Role>(`${BASE}/admin/roles/${roleId}/${active ? 'activate' : 'deactivate'}`, {
    method: 'POST',
  }).then((r) => r.data)

export const deleteRole = (roleId: string) =>
  apiRequest(`${BASE}/admin/roles/${roleId}`, { method: 'DELETE', acceptStatuses: [204] })

export const listRoleUsers = (roleId: string) =>
  apiGet<{ items: Membership[] }>(`${BASE}/admin/roles/${roleId}/users`).then((r) => r.items)

// ---- permissions --------------------------------------------------------------------------------

export const listPermissions = () =>
  apiGet<{ items: Permission[] }>(`${BASE}/admin/permissions`).then((r) => r.items)

// ---- users --------------------------------------------------------------------------------------

export const listUsers = () => apiGet<{ items: AppUser[] }>(`${BASE}/admin/users`).then((r) => r.items)
export const createUser = (body: {
  username: string
  display_name: string
  email?: string | null
  password?: string | null
}) => apiRequest<AppUser>(`${BASE}/admin/users`, { method: 'POST', json: body }).then((r) => r.data)
export const setUserActive = (userId: string, active: boolean) =>
  apiRequest<AppUser>(`${BASE}/admin/users/${userId}/${active ? 'activate' : 'deactivate'}`, {
    method: 'POST',
  }).then((r) => r.data)
export const getUserEffectivePermissions = (userId: string) =>
  apiGet<EffectivePermissions>(`${BASE}/admin/users/${userId}/effective-permissions`)

// ---- memberships --------------------------------------------------------------------------------

export const listMemberships = (principalId?: string) =>
  apiGet<{ items: Membership[] }>(
    `${BASE}/admin/memberships${principalId ? `?principal_id=${encodeURIComponent(principalId)}` : ''}`,
  ).then((r) => r.items)

export const grantMembership = (body: {
  principal_id: string
  role_code: string
  scope_type: string
  scope_id?: string | null
}) => apiRequest<Membership>(`${BASE}/admin/memberships`, { method: 'POST', json: body }).then((r) => r.data)

export const revokeMembership = (membershipId: string, reason?: string) =>
  apiRequest(`${BASE}/admin/memberships/${membershipId}`, {
    method: 'DELETE',
    json: reason ? { reason } : undefined,
    acceptStatuses: [204],
  })

export const authzCheck = (permission: string, resourceType?: string, resourceId?: string) =>
  apiRequest<{ allowed: boolean }>(`${BASE}/authz/check`, {
    method: 'POST',
    json: { permission, resource_type: resourceType, resource_id: resourceId },
  }).then((r) => r.data)
