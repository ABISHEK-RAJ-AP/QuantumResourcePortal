import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth.js'

test.beforeEach(async ({ page }) => {
  await seedPortalSession(page)
})

test('inventory hub switches catalogue pools backends', async ({ page }) => {
  await page.goto('/qrp/inventory')
  await expect(page.getByRole('heading', { name: 'Inventory catalogue' })).toBeVisible()
  await page.getByRole('tab', { name: 'Pools' }).click()
  await expect(page).toHaveURL(/tab=pools/)
  await expect(page.getByRole('heading', { name: 'Resource pools' })).toBeVisible()
  await page.getByRole('tab', { name: 'Backends' }).click()
  await expect(page).toHaveURL(/tab=backends/)
  await expect(page.getByRole('heading', { name: 'Backends' })).toBeVisible()
})