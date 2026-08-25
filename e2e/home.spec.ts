import { expect, test } from '@playwright/test'

test('renders the StockLab v0.1.0 shell', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByText('2018-01-01')).toBeVisible()
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.1.0')).toBeVisible()
})
