import { expect, test } from '@playwright/test'

test('renders the StockLab v0.3.0 shell and advances to the first trading day', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.3.0')).toBeVisible()

  const nextDayButton = page.getByRole('button', { name: '+1일' })
  await expect(nextDayButton).toBeEnabled()
  await nextDayButton.click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')
})
