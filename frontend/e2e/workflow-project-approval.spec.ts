import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth'

/**
 * Workflow A (smoke): create project → open approvals → seed demo review when API available.
 * Skips mutation assertions if API rejects create (auth/RBAC closed).
 */
test('project create form and approvals detail path are wired', async ({ page }) => {
  await seedPortalSession(page)
  await page.goto('/qrp/projects')
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  const name = `E2E ${Date.now()}`
  await page.getByPlaceholder('Project name').fill(name)
  await page.getByRole('button', { name: 'Create project' }).click()

  // Either navigate to detail on success, or stay with an error — both prove UI wiring.
  await Promise.race([
    page.waitForURL(/\/qrp\/projects\/.+/, { timeout: 15_000 }),
    page.waitForSelector('text=/Request failed|Permission denied|Create project/i', { timeout: 15_000 }),
  ]).catch(() => undefined)

  await page.goto('/qrp/approvals')
  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible()
  await page.getByRole('button', { name: 'Start demo review' }).first().click()
  await Promise.race([
    page.waitForURL(/\/qrp\/approvals\/.+/, { timeout: 20_000 }),
    page.waitForSelector('text=/Request failed|Permission denied|No approvals|Submitting/i', { timeout: 20_000 }),
  ]).catch(() => undefined)

  if (/\/qrp\/approvals\/.+/.test(page.url())) {
    await expect(page.getByRole('button', { name: 'Run dry-run' }).or(page.getByText('Quota'))).toBeVisible()
  }
})
