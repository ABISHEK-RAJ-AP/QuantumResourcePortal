import { Navigate, Outlet, useLocation } from 'react-router'

import { isSignedIn } from '@/lib/session'

export function RequireAuth() {
  const location = useLocation()
  if (!isSignedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
