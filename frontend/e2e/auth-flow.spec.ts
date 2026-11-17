import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth.js'

test('unauthenticated /qrp redirects to login with return path', async ({ page }) => {
  await page.goto('/qrp')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('authenticated session reaches home and profile', async ({ page }) => {
  await seedPortalSession(page)
  await page.goto('/qrp')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await page.goto('/qrp/profile')
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible()
})

test('mfa route is reachable after login gate', async ({ page }) => {
  await page.goto('/mfa')
  await expect(page.getByRole('heading', { name: /Additional verification/i })).toBeVisible()
})