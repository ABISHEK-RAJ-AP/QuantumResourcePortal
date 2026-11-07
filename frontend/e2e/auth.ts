import type { Page } from '@playwright/test'

/**
 * RBAC-9: authenticate the e2e browser the real way — a cookie session from `/api/v1/auth/login`.
 * The old localStorage token/role seeding is gone (that trust model was removed in RBAC-6/7). Set
 * E2E_ADMIN_USER / E2E_ADMIN_PW (and the researcher pair) to accounts in your test deployment.
 */
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin'
const ADMIN_PW = process.env.E2E_ADMIN_PW ?? 'change-me-admin-123'
const RESEARCHER_USER = process.env.E2E_RESEARCHER_USER ?? 'researcher'
const RESEARCHER_PW = process.env.E2E_RESEARCHER_PW ?? 'change-me-researcher-123'

/** Log in through the real API; the session cookie is stored in the page's browser context. */
export async function login(page: Page, username: string, password: string): Promise<string> {
  const res = await page.request.post('/api/v1/auth/login', { data: { username, password } })
  if (!res.ok()) throw new Error(`login failed (${res.status()}) for ${username}`)
  const body = (await res.json()) as { csrf_token: string }
  return body.csrf_token
}

/** Seed a signed-in admin session (back-compat name used by existing specs). */
export async function seedPortalSession(page: Page): Promise<string> {
  return login(page, ADMIN_USER, ADMIN_PW)
}

export const E2E_USERS = {
  admin: { username: ADMIN_USER, password: ADMIN_PW },
  researcher: { username: RESEARCHER_USER, password: RESEARCHER_PW },
}
