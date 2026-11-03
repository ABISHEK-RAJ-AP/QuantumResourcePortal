import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the Vite dev server, which proxies to a running backend.
 * Start the backend first (make dev-api); Playwright starts Vite itself if it is not running.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5176',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5176',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
