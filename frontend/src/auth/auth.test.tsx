/**
 * Unit tests for the RBAC UI layer (RBAC-6): the auth hooks, PermissionGate and ProtectedRoute.
 *
 * These assert the *gating* behaviour only. The backend is the real authority; these tests lock in
 * that the UI hides/shows the right controls and that an unauthenticated or under-privileged user is
 * routed correctly. The `@/api/rbac` module is mocked so no network is touched.
 */
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/auth/AuthContext'
import { PermissionGate } from '@/auth/PermissionGate'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { useAuth, useHasAnyPermission, useHasPermission, useHasRole } from '@/auth/hooks'

// --- mock the typed RBAC client -------------------------------------------------------------
vi.mock('@/api/rbac', () => ({
  getMe: vi.fn(),
  getCsrf: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))
// client.ts side effects (CSRF/401 wiring) are harmless no-ops under jsdom, but stub them anyway.
vi.mock('@/api/client', () => ({
  setCsrfToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

import * as rbac from '@/api/rbac'

const getMe = vi.mocked(rbac.getMe)
const getCsrf = vi.mocked(rbac.getCsrf)

function meWith(permissions: string[], roles: string[] = []) {
  return {
    authenticated: true,
    principal_id: 'u-1',
    tenant_id: 't-1',
    roles,
    permissions,
  }
}

beforeEach(() => {
  getCsrf.mockResolvedValue({ csrf_token: 'csrf-test' } as never)
})

afterEach(() => {
  vi.clearAllMocks()
})

/** Render `children` inside a settled AuthProvider (waits for the /me load to finish). */
async function renderAuthed(ui: ReactNode, { authed = true, permissions = [] as string[], roles = [] as string[] } = {}) {
  if (authed) {
    getMe.mockResolvedValue(meWith(permissions, roles) as never)
  } else {
    getMe.mockRejectedValue(new Error('401'))
  }
  render(
    <MemoryRouter initialEntries={['/start']}>
      <AuthProvider>
        <Routes>
          <Route path="/start" element={<>{ui}</>} />
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  // AuthProvider shows nothing until loading flips; wait until a known sentinel or page appears.
  await waitFor(() => expect(getMe).toHaveBeenCalled())
}

// --- hooks ----------------------------------------------------------------------------------
function HookProbe() {
  const { user, loading } = useAuth()
  const canCreate = useHasPermission('asset:create')
  const canDecideOrRead = useHasAnyPermission('approval:decide', 'approval:read')
  const isAuditor = useHasRole('AUDITOR')
  if (loading) return <div>loading</div>
  return (
    <div>
      <span data-testid="user">{user?.principal_id ?? 'none'}</span>
      <span data-testid="create">{String(canCreate)}</span>
      <span data-testid="any">{String(canDecideOrRead)}</span>
      <span data-testid="auditor">{String(isAuditor)}</span>
    </div>
  )
}

describe('auth hooks', () => {
  it('reflects the granted permissions and roles from /me', async () => {
    await renderAuthed(<HookProbe />, {
      permissions: ['asset:create', 'approval:read'],
      roles: ['AUDITOR'],
    })
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u-1'))
    expect(screen.getByTestId('create')).toHaveTextContent('true')
    expect(screen.getByTestId('any')).toHaveTextContent('true') // has approval:read
    expect(screen.getByTestId('auditor')).toHaveTextContent('true')
  })

  it('denies permissions that were not granted (deny-by-default)', async () => {
    await renderAuthed(<HookProbe />, { permissions: ['approval:read'], roles: [] })
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('u-1'))
    expect(screen.getByTestId('create')).toHaveTextContent('false') // no asset:create
    expect(screen.getByTestId('any')).toHaveTextContent('true') // approval:read still matches
    expect(screen.getByTestId('auditor')).toHaveTextContent('false')
  })

  it('exposes no user and no permissions when the session check fails', async () => {
    await renderAuthed(<HookProbe />, { authed: false })
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'))
    expect(screen.getByTestId('create')).toHaveTextContent('false')
    expect(screen.getByTestId('any')).toHaveTextContent('false')
  })

  it('useAuth throws when used outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bare() {
      useAuth()
      return null
    }
    expect(() => render(<Bare />)).toThrow(/within <AuthProvider>/)
    spy.mockRestore()
  })
})

// --- PermissionGate -------------------------------------------------------------------------
describe('PermissionGate', () => {
  it('renders children when the single permission is held', async () => {
    await renderAuthed(
      <PermissionGate permission="asset:create">
        <button>New asset</button>
      </PermissionGate>,
      { permissions: ['asset:create'] },
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'New asset' })).toBeInTheDocument())
  })

  it('renders the fallback (and not the children) when the permission is missing', async () => {
    await renderAuthed(
      <PermissionGate permission="asset:create" fallback={<span>no access</span>}>
        <button>New asset</button>
      </PermissionGate>,
      { permissions: ['asset:read'] },
    )
    await waitFor(() => expect(screen.getByText('no access')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'New asset' })).not.toBeInTheDocument()
  })

  it('supports anyOf semantics', async () => {
    await renderAuthed(
      <PermissionGate anyOf={['approval:decide', 'approval:read']}>
        <span>queue</span>
      </PermissionGate>,
      { permissions: ['approval:read'] },
    )
    await waitFor(() => expect(screen.getByText('queue')).toBeInTheDocument())
  })

  it('renders children when neither permission nor anyOf is specified', async () => {
    await renderAuthed(
      <PermissionGate>
        <span>always</span>
      </PermissionGate>,
      { permissions: [] },
    )
    await waitFor(() => expect(screen.getByText('always')).toBeInTheDocument())
  })
})

// --- ProtectedRoute -------------------------------------------------------------------------
describe('ProtectedRoute', () => {
  it('renders the protected content when the permission is held', async () => {
    await renderAuthed(
      <ProtectedRoute permission="role:read">
        <div>ROLES ADMIN</div>
      </ProtectedRoute>,
      { permissions: ['role:read'] },
    )
    await waitFor(() => expect(screen.getByText('ROLES ADMIN')).toBeInTheDocument())
  })

  it('shows the access-denied page in place when the permission is missing', async () => {
    await renderAuthed(
      <ProtectedRoute permission="role:read">
        <div>ROLES ADMIN</div>
      </ProtectedRoute>,
      { permissions: ['asset:read'] },
    )
    await waitFor(() => expect(screen.queryByText('ROLES ADMIN')).not.toBeInTheDocument())
    // AccessDeniedPage is rendered in place rather than redirecting (URL preserved).
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument()
  })

  it('redirects an unauthenticated user to /login', async () => {
    await renderAuthed(
      <ProtectedRoute permission="role:read">
        <div>ROLES ADMIN</div>
      </ProtectedRoute>,
      { authed: false },
    )
    await waitFor(() => expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument())
    expect(screen.queryByText('ROLES ADMIN')).not.toBeInTheDocument()
  })
})
