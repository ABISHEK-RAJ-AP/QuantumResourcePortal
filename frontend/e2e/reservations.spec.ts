import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth.js'

test.beforeEach(async ({ page }) => {
  await seedPortalSession(page)
})

test('reservations calendar and scheduling deep link', async ({ page }) => {
  await page.goto('/qrp/reservations')
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('link', { name: 'Request a window' }).click()
  await expect(page).toHaveURL(/\/qrp\/scheduling/)
  await expect(page.getByRole('heading', { name: 'Request reservation window' })).toBeVisible()
})