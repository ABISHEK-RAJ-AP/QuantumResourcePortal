import { expect, test } from '@playwright/test'

test('landing section nav updates location hash', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Page sections' }).getByRole('link', { name: 'FAQ' }).click()
  await expect(page).toHaveURL(/\/#faq/)
  await expect(page.locator('#faq')).toBeVisible()
})

test('auth compact footer navigates to landing section', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Capabilities' }).click()
  await expect(page).toHaveURL(/\/#capabilities/)
  await expect(page.locator('#capabilities')).toBeVisible()
})

test('auth header navigates to landing section', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('navigation', { name: 'Page sections' }).getByRole('link', { name: 'FAQ' }).click()
  await expect(page).toHaveURL(/\/#faq/)
  await expect(page.locator('#faq')).toBeVisible()
})