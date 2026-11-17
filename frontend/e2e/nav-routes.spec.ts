import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth.js'

/** Smoke that consolidated IA routes render without client errors (Sprint 4 gate). */
const ROUTES: { path: string; heading: RegExp | string }[] = [
  { path: '/qrp', heading: 'Home' },
  { path: '/qrp/centre', heading: 'Operations Centre' },
  { path: '/qrp/approvals', heading: 'Review Queue' },
  { path: '/qrp/projects', heading: 'Projects' },
  { path: '/qrp/inventory', heading: /Inventory|Resources/i },
  { path: '/qrp/providers', heading: /Providers|Facilities/i },
  { path: '/qrp/jobs', heading: 'Provider jobs' },
  { path: '/qrp/reservations', heading: 'Reservations' },
  { path: '/qrp/policies', heading: 'Policies' },
  { path: '/qrp/quotas', heading: 'Quotas' },
  { path: '/qrp/metering', heading: 'Metering' },
  { path: '/qrp/audit', heading: 'Audit Trail' },
  { path: '/qrp/settings', heading: 'Settings' },
]

test.beforeEach(async ({ page }) => {
  await seedPortalSession(page)
})

for (const { path, heading } of ROUTES) {
  test(`nav route ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
  })
}