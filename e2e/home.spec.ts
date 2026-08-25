import { expect, test } from '@playwright/test'

test('renders v0.6.0, exposes market orders, and opens the WS Securities FX screen', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.6.0')).toBeVisible()

  const nextDayButton = page.getByRole('button', { name: '+1일' })
  await expect(nextDayButton).toBeEnabled()
  await nextDayButton.click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')

  await page.getByRole('button', { name: '시장 보기' }).click()
  await expect(page.getByRole('heading', { name: '시장 탐색' })).toBeVisible()
  await expect(page.getByText('영진전자').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'WS증권 주문' })).toBeVisible()
  await expect(page.getByRole('button', { name: '오늘 시가 매수 주문' })).toBeDisabled()

  await page.locator('button:visible').filter({ hasText: '자산' }).click()
  await expect(page.getByRole('heading', { name: '원화 · 달러 환전' })).toBeVisible()
  await expect(page.getByText('한국은행 ECOS').first()).toBeVisible()
  await expect(page.getByText('환율 데이터 준비 중')).toBeVisible()
  await expect(page.getByText('Save schema v3')).toBeVisible()
})
