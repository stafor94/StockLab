import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
    version: 10,
  })))
})

async function advanceOneDay(page: import('@playwright/test').Page, expectedDate: string) {
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '다음 날' }).click()
  await expect(page.getByLabel('현재 날짜')).toContainText(expectedDate)
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()
}

test('market rows show known price and red/blue previous-close change', async ({ page }) => {
  await page.goto('./')
  await advanceOneDay(page, '2018-01-02')

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).click()

  const sessionAction = page.locator('.session-action-button')
  await expect(sessionAction).toHaveText('장 시작')
  await sessionAction.click()
  await expect(sessionAction).toHaveText('장 마감')
  await sessionAction.click()
  await expect(sessionAction).toHaveText('오늘 장 마감 완료')

  await advanceOneDay(page, '2018-01-03')
  await expect(sessionAction).toHaveText('장 시작')
  await sessionAction.click()
  await expect(sessionAction).toHaveText('장 마감')

  const rising = page.getByRole('button', { name: '영진전자 주문 거래 열기' })
  const risingQuote = rising.locator('.asset-list-quote')
  await expect(risingQuote.locator('strong')).toHaveText('₩2,627,000')
  await expect(risingQuote.locator('small')).toHaveText('+2.98%')
  await expect(risingQuote.locator('small')).toHaveClass(/positive/)

  const falling = page.getByRole('button', { name: '새봄네트웍스 주문 거래 열기' })
  const fallingQuote = falling.locator('.asset-list-quote')
  await expect(fallingQuote.locator('strong')).toHaveText('₩876,000')
  await expect(fallingQuote.locator('small')).toHaveText('-1.02%')
  await expect(fallingQuote.locator('small')).toHaveClass(/negative/)

  const colors = await page.evaluate(() => {
    const positive = document.querySelector('.asset-list-quote small.positive')
    const negative = document.querySelector('.asset-list-quote small.negative')
    return {
      positive: positive ? getComputedStyle(positive).color : null,
      negative: negative ? getComputedStyle(negative).color : null,
    }
  })
  expect(colors.positive).toBe('rgb(240, 68, 82)')
  expect(colors.negative).toBe('rgb(57, 120, 232)')
})
