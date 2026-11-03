import { expect, test } from '@playwright/test'

test('platform status shows the full browser → API → database path as ready', async ({ page }) => {
  await page.addInitScript(() => {
    const user = {
      username: 'admin',
      role: 'Admin',
      full_name: 'Platform Admin',
      org: 'C-DAC',
      token: 'e2e-dev',
    }
    localStorage.setItem('qrp_token', user.token)
    localStorage.setItem('qrp_user', JSON.stringify(user))
    localStorage.setItem('qre_role', user.role)
    localStorage.setItem('qre_user', user.username)
  })
  await page.goto('/system/status')
  await expect(page).toHaveURL(/\/system\/status$/)
  await expect(page.getByRole('heading', { name: 'Platform status' })).toBeVisible()
  await expect(page.getByText('Ready', { exact: true })).toBeVisible()
  await expect(page.getByText('PostgreSQL database')).toBeVisible()
  await expect(page.getByText(/^at head /)).toBeVisible()

  // No horizontal scrolling at any viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
