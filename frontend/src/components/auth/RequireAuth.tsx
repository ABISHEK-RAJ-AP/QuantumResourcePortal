import { Navigate, Outlet, useLocation } from 'react-router'

import { LoadingLine } from '@/components/layout/Page'
import { useAuth } from '@/auth/hooks'

/** Gate the workspace: wait for the session check, then require an authenticated user (RBAC-6). */
export function RequireAuth() {
  const location = useLocation()
  const { loading, user } = useAuth()

  if (loading) {
    return (
      <div className="shell-canvas px-6 py-8" aria-busy="true">
        <LoadingLine rows={2} />
        <p className="mt-3 text-center text-sm text-muted-foreground">Checking your session…</p>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
