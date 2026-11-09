/** Render children only when the principal holds the permission(s). UX gating only. */
import type { ReactNode } from 'react'

import { useAuth } from '@/auth/hooks'

export function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: string
  anyOf?: string[]
  fallback?: ReactNode
  children: ReactNode
}) {
  const { hasPermission, hasAnyPermission } = useAuth()
  const allowed = permission
    ? hasPermission(permission)
    : anyOf
      ? hasAnyPermission(...anyOf)
      : true
  return <>{allowed ? children : fallback}</>
}
