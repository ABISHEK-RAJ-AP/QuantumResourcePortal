/**
 * Route → required permission map (RBAC-6). Shared by the router (ProtectedRoute) and any
 * sidebar that mirrors it. Mirrors the server's NAV_REGISTRY (backend `core/authz.py`); the server
 * remains the authority via GET /me/navigation and per-endpoint checks.
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/qrp/admin/roles': 'role:read',
  '/qrp/admin/roles/new': 'role:create',
  '/qrp/admin/permissions': 'permission:read',
  '/qrp/admin/users': 'user:read',
}

export function permissionForRoute(path: string): string | undefined {
  if (ROUTE_PERMISSIONS[path]) return ROUTE_PERMISSIONS[path]
  // Longest-prefix match for detail/edit routes (e.g. /qrp/admin/roles/:id).
  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((base) => path.startsWith(base + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return match ? ROUTE_PERMISSIONS[match] : undefined
}
