import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from '@/auth/hooks'

/** Gate the workspace: wait for the session check, then require an authenticated user (RBAC-6). */
export function RequireAuth() {
  const location = useLocation()
  const { loading, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
