/**
 * Route guard (RBAC-6): requires an authenticated session and, optionally, a permission. A signed-in
 * user who lacks the permission sees the access-denied page in place (the URL is kept), so entering a
 * restricted URL directly never exposes data. Unauthenticated users go to /login.
 */
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useAuth } from '@/auth/hooks'
import { AccessDeniedPage } from '@/pages/system/AccessDeniedPage'

export function ProtectedRoute({
  permission,
  children,
}: {
  permission?: string
  children: ReactNode
}) {
  const { loading, user, hasPermission } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (permission && !hasPermission(permission)) {
    return <AccessDeniedPage permission={permission} />
  }
  return <>{children}</>
}
