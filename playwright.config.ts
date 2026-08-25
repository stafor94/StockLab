import { defineConfig } from '@playwright/test'

const chromiumTouch = { browserName: 'chromium' as const, deviceScaleFactor: 1, hasTouch: true, isMobile: true }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173/StockLab/', trace: 'on-first-retry' },
  projects: [
    { name: 'mobile-360', use: { ...chromiumTouch, viewport: { width: 360, height: 800 } } },
    { name: 'mobile-390', use: { ...chromiumTouch, viewport: { width: 390, height: 844 } } },
    { name: 'tablet-768', use: { ...chromiumTouch, viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1280', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173/StockLab/', reuseExistingServer: !process.env.CI },
})
