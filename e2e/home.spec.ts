import { expect, test } from '@playwright/test'

test('renders v0.9.0 with corporate action pipeline ready', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.9.0')).toBeVisible()

  const nextDayButton = page.getByRole('button', { name: '+1일' })
  await expect(nextDayButton).toBeEnabled()
  await nextDayButton.click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')
  await expect(page.getByRole('heading', { name: '오늘의 기업 이벤트' })).toBeVisible()

  await page.getByRole('button', { name: '시장 보기' }).click()
  await expect(page.getByRole('heading', { name: '시장 탐색' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'WS증권 주문' })).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '자산' }).click()
  await expect(page.getByRole('heading', { name: '원화 · 달러 환전' })).toBeVisible()
  await page.getByRole('button', { name: 'WS은행 대출' }).click()
  await expect(page.getByRole('heading', { name: 'WS 직장인 신용대출' })).toBeVisible()
  await expect(page.getByText('4.50%').first()).toBeVisible()
  await expect(page.getByText('Save schema v6')).toBeVisible()
})
