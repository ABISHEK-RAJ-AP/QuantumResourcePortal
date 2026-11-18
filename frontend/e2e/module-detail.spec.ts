import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth.js'

test.beforeEach(async ({ page }) => {
  await seedPortalSession(page)
})

test('approval detail shows quota evaluation from API', async ({ page }) => {
  await page.goto('/qrp/approvals')
  await expect(page.getByRole('heading', { name: 'Review Queue' })).toBeVisible()
  const rowLink = page.locator('table a[href*="/qrp/approvals/"]').first()
  if ((await rowLink.count()) === 0) {
    test.skip(true, 'No workloads in queue — seed demo data first')
  }
  await rowLink.click()
  await expect(page.getByText('Quota evaluation')).toBeVisible()
  await expect(page.getByText(/Requested shots|Within daily shot cap|Over daily shot cap/).first()).toBeVisible()
})

test('job detail shows execution timeline tab', async ({ page }) => {
  await page.goto('/qrp/jobs')
  await expect(page.getByRole('heading', { name: 'Provider jobs' })).toBeVisible()
  const jobLink = page.locator('table a[href*="/qrp/jobs/"], a[href*="/qrp/jobs/demo-"]').first()
  if ((await jobLink.count()) === 0) {
    test.skip(true, 'No provider jobs — seed demo data first')
  }
  await jobLink.click()
  await page.getByRole('button', { name: /Execution timeline/i }).click()
  await expect(page.getByText('Execution timeline')).toBeVisible()
})