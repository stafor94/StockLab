import { expect, test } from '@playwright/test'

test('renders v0.4.0, advances date, and opens the masked market browser', async ({ page }) => {
  await page.goto('./')

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('v0.4.0')).toBeVisible()

  const nextDayButton = page.getByRole('button', { name: '+1일' })
  await expect(nextDayButton).toBeEnabled()
  await nextDayButton.click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')

  await page.getByRole('button', { name: '시장 보기' }).click()
  await expect(page.getByRole('heading', { name: '시장 탐색' })).toBeVisible()
  await expect(page.getByText('영진전자').first()).toBeVisible()
  await expect(page.getByText('WS 코리아200').first()).toBeVisible()
  await expect(page.getByText('청명배터리')).toHaveCount(0)
  await expect(page.getByText('가격 데이터 준비 중').first()).toBeVisible()
})
