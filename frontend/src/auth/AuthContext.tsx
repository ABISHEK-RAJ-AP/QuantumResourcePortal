/**
 * Authentication + authorisation context (RBAC-6).
 *
 * On mount it calls GET /me before rendering protected data (LLD §11.3) and fetches a fresh CSRF
 * token (held in memory only, LLD §11.6). The permission set is the single source for UI gating —
 * but the backend is the real authority; hiding a control is UX only.
 */
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { setCsrfToken, setUnauthorizedHandler } from '@/api/client'
import * as rbac from '@/api/rbac'

export interface AuthState {
  loading: boolean
  user: rbac.Me | null
  permissions: Set<string>
  roles: Set<string>
  login: (
    username: string,
    password: string,
    captcha?: { captcha_id: string; captcha_code: string },
  ) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  hasPermission: (code: string) => boolean
  hasAnyPermission: (...codes: string[]) => boolean
  hasRole: (code: string) => boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<rbac.Me | null>(null)

  const loadSession = useCallback(async () => {
    try {
      const me = await rbac.getSession()
      if (!me.authenticated) {
        setUser(null)
        setCsrfToken(null)
        return
      }
      setUser(me)
      try {
        const { csrf_token } = await rbac.getCsrf()
        setCsrfToken(csrf_token)
      } catch {
        setCsrfToken(null)
      }
    } catch {
      setUser(null)
      setCsrfToken(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    setUnauthorizedHandler(() => {
      if (active) {
        setUser(null)
        setCsrfToken(null)
      }
    })
    void loadSession().finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      setUnauthorizedHandler(null)
    }
  }, [loadSession])

  const login = useCallback(
    async (
      username: string,
      password: string,
      captcha?: { captcha_id: string; captcha_code: string },
    ) => {
      const result = await rbac.login(username, password, captcha)
      setCsrfToken(result.csrf_token)
      await loadSession()
    },
    [loadSession],
  )

  const logout = useCallback(async () => {
    try {
      await rbac.logout()
    } finally {
      setUser(null)
      setCsrfToken(null)
    }
  }, [])

  const value = useMemo<AuthState>(() => {
    const permissions = new Set(user?.permissions ?? [])
    const roles = new Set(user?.roles ?? [])
    return {
      loading,
      user,
      permissions,
      roles,
      login,
      logout,
      refresh: loadSession,
      hasPermission: (code: string) => permissions.has(code),
      hasAnyPermission: (...codes: string[]) => codes.some((c) => permissions.has(c)),
      hasRole: (code: string) => roles.has(code),
    }
  }, [loading, user, login, logout, loadSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
