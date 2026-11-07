/**
 * RBAC-9 end-to-end authorization scenario.
 *
 * Proves the backend is the authority (S-11, plan §9): the browser cannot reach protected data without
 * a session, a signed-in admin sees the Access Control area, and a researcher is denied admin APIs even
 * by calling them directly. Run against a full stack (QRP API + gateway + TeleScope) with E2E_* creds.
 *
 * These are intentionally API-and-UI checks via Playwright's request context + page; they need live
 * servers, so they are skipped automatically when E2E_RUN_RBAC is not set.
 */
import { expect, test } from '@playwright/test'

import { E2E_USERS, login } from './auth.js'

test.skip(!process.env.E2E_RUN_RBAC, 'Set E2E_RUN_RBAC=1 and E2E_* creds to run against a live stack.')

test('unauthenticated direct API call is rejected (no client-side bypass, S-11)', async ({ page }) => {
  const res = await page.request.get('/api/v1/admin/roles')
  expect(res.status()).toBe(401)
})

test('a forged X-User-Role header grants nothing (S-1)', async ({ page }) => {
  const res = await page.request.get('/api/v1/admin/roles', {
    headers: { 'X-User-Role': 'PLATFORM_ADMIN' },
  })
  expect(res.status()).toBe(401)
})

test('admin can read roles and sees the Access Control nav', async ({ page }) => {
  await login(page, E2E_USERS.admin.username, E2E_USERS.admin.password)
  const res = await page.request.get('/api/v1/admin/roles')
  expect(res.ok()).toBeTruthy()

  await page.goto('/qrp')
  await expect(page.getByText('Access Control')).toBeVisible()
})

test('researcher is denied admin APIs and the admin screens (deny-by-default)', async ({ page }) => {
  await login(page, E2E_USERS.researcher.username, E2E_USERS.researcher.password)
  // Direct API call is forbidden even though the user is authenticated.
  const res = await page.request.get('/api/v1/admin/roles')
  expect(res.status()).toBe(403)

  // Navigating straight to the admin URL shows the in-place access-denied page, not the data.
  await page.goto('/qrp/admin/roles')
  await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible()
})
