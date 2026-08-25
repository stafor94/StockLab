import { expect, test } from '@playwright/test'

test('renders v0.13.0 with explicit open and close sessions', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.13.0')).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '포트폴리오' }).first().click()
  await expect(page.getByRole('heading', { name: '내 포트폴리오' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '수익률 배지' })).toBeVisible()
  await expect(page.getByText('초보 투자자').first()).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '홈' }).first().click()
  const nextDay = page.getByRole('button', { name: '+1일' })
  await expect(nextDay).toBeEnabled()
  await nextDay.click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')

  await expect(nextDay).toBeDisabled()
  const openMarket = page.getByRole('button', { name: '장 시작' })
  await expect(openMarket).toBeEnabled()
  await openMarket.click()
  await expect(page.getByText(/당일 시가가 공개되었습니다/)).toBeVisible()

  const closeMarket = page.getByRole('button', { name: '장 마감' })
  await expect(closeMarket).toBeEnabled()
  await closeMarket.click()
  await expect(page.getByText(/당일 OHLC가 공개/)).toBeVisible()
  await expect(nextDay).toBeEnabled()

  await page.getByRole('button', { name: '10×' }).click()
  const autoplay = page.getByRole('button', { name: '자동진행' })
  await autoplay.click()
  await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).not.toContainText('2018-01-02', { timeout: 2000 })
  const pause = page.getByRole('button', { name: '일시정지' })
  if (await pause.isVisible()) await pause.click()

  await page.locator('button:visible').filter({ hasText: '뉴스' }).first().click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await expect(page.getByText('게임 날짜까지 실제로 공개된 정보만 표시합니다.')).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '자산' }).first().click()
  await page.getByRole('button', { name: 'WS은행 대출' }).click()
  await expect(page.getByRole('heading', { name: 'WS 직장인 신용대출' })).toBeVisible()
  await expect(page.getByText('Save schema v9')).toBeVisible()
})
