import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth.js'

test.beforeEach(async ({ page }) => {
  await seedPortalSession(page)
})

test('jobs workspace exposes jobs and queues tabs', async ({ page }) => {
  await page.goto('/qrp/jobs')
  await expect(page.getByRole('heading', { name: 'Provider jobs' })).toBeVisible()
  await page.getByRole('tab', { name: 'Queues' }).click()
  await expect(page).toHaveURL(/tab=queues/)
  await expect(page.getByRole('heading', { name: 'Queue depth' })).toBeVisible()
  await expect(page.getByText('Wait (est.)').first()).toBeVisible()
})