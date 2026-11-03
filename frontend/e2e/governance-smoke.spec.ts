import { expect, test } from '@playwright/test'

import { seedPortalSession } from './auth'

test.beforeEach(async ({ page }) => {
  await seedPortalSession(page)
})

test('overview loads governance KPIs and navigation actions', async ({ page }) => {
  await page.goto('/qrp')
  await expect(page).toHaveURL(/\/qrp\/?$/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await expect(page.getByText('Shots remaining')).toBeVisible()
  await expect(page.getByText('Reconcile backlog')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Approvals' }).first()).toBeVisible()
})

test('approvals page exposes server filter presets', async ({ page }) => {
  await page.goto('/qrp/approvals')
  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Queue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mine' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start demo review' }).first()).toBeVisible()
})

test('queues page states wait provenance honestly', async ({ page }) => {
  await page.goto('/qrp/queues')
  await expect(page.getByRole('heading', { name: 'Queues' })).toBeVisible()
  await expect(page.getByText(/BackendTelemetry|telemetry samples/i).first()).toBeVisible()
  await expect(page.getByText('Wait (est.)')).toBeVisible()
})

test('jobs page labels provider execution state', async ({ page }) => {
  await page.goto('/qrp/jobs')
  await expect(page.getByRole('heading', { name: 'Provider jobs' })).toBeVisible()
  await expect(page.getByText(/Not QRP governance/i)).toBeVisible()
  await expect(page.getByText('Provider status')).toBeVisible()
})

test('reconciliation defaults toward unresolved work', async ({ page }) => {
  await page.goto('/qrp/reconciliation')
  await expect(page.getByRole('heading', { name: 'Reconciliation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Needs reconcile' })).toBeVisible()
  await expect(page.getByText('Needs reconcile').first()).toBeVisible()
})

test('deferred procurement stays out of scope', async ({ page }) => {
  await page.goto('/qrp/procurement')
  await expect(page.getByRole('heading', { name: 'Procurement' })).toBeVisible()
  await expect(page.getByText(/Not in operational scope|not a procurement/i).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inventory' })).toBeVisible()
})

test('quotas shows ledger window controls', async ({ page }) => {
  await page.goto('/qrp/quotas')
  await expect(page.getByRole('heading', { name: 'Quotas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
  await expect(page.getByText('Usage vs cap').or(page.getByText('Quota bar unavailable'))).toBeVisible()
})

test('settings exposes sign out and session', async ({ page }) => {
  await page.goto('/qrp/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByText('admin')).toBeVisible()
})
