import { expect, test } from '@playwright/test'

test('renders v0.10.0 with news and autoplay controls', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.10.0')).toBeVisible()

  const autoplay = page.getByRole('button', { name: '자동진행' })
  await expect(autoplay).toBeEnabled()
  await autoplay.click()
  await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).not.toContainText('2018-01-01', { timeout: 2500 })
  await page.getByRole('button', { name: '일시정지' }).click()
  await expect(page.getByRole('button', { name: '10×' })).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '뉴스' }).first().click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await expect(page.getByText('권위 있는 출처로 큐레이션된 뉴스가 추가되기 전에는 임의의 기사를 생성하지 않습니다.')).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '시장' }).first().click()
  await expect(page.getByRole('heading', { name: '시장 탐색' })).toBeVisible()

  await page.locator('button:visible').filter({ hasText: '자산' }).first().click()
  await page.getByRole('button', { name: 'WS은행 대출' }).click()
  await expect(page.getByRole('heading', { name: 'WS 직장인 신용대출' })).toBeVisible()
  await expect(page.getByText('Save schema v7')).toBeVisible()
})
