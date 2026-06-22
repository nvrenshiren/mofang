import { defineConfig } from 'playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:5188',
    headless: true,
    viewport: { width: 1400, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5188',
    url: 'http://localhost:5188',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  reporter: [['list']],
})
