import { expect, test } from '@playwright/test'

test('renders v0.12.0 with curated historical content', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.12.0')).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '포트폴리오' }).first().click()
  await expect(page.getByRole('heading', { name: '내 포트폴리오' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '수익률 배지' })).toBeVisible()
  await expect(page.getByText('초보 투자자').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '보유 자산' })).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '홈' }).first().click()
  const autoplay = page.getByRole('button', { name: '자동진행' })
  await expect(autoplay).toBeEnabled()
  await autoplay.click()
  await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).not.toContainText('2018-01-01', { timeout: 2500 })
  await page.getByRole('button', { name: '일시정지' }).click()

  await page.locator('button:visible').filter({ hasText: '뉴스' }).first().click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await expect(page.getByText('2018년 뉴스')).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '자산' }).first().click()
  await page.getByRole('button', { name: 'WS은행 대출' }).click()
  await expect(page.getByRole('heading', { name: 'WS 직장인 신용대출' })).toBeVisible()
  await expect(page.getByText('Save schema v8')).toBeVisible()
})
