import type { Page } from '@playwright/test'

/** Seed a signed-in portal session (dev token; backend must accept or leave RBAC open). */
export async function seedPortalSession(page: Page) {
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
}
