/** Authorisation hooks (RBAC-6). These gate the UI only; the backend enforces every action. */
import { useContext } from 'react'

import { AuthContext, type AuthState } from '@/auth/AuthContext'

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function usePermissions(): Set<string> {
  return useAuth().permissions
}

export function useHasPermission(code: string): boolean {
  return useAuth().hasPermission(code)
}

export function useHasAnyPermission(...codes: string[]): boolean {
  return useAuth().hasAnyPermission(...codes)
}

export function useHasRole(code: string): boolean {
  return useAuth().hasRole(code)
}
