import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: {
      gameDate: '2018-01-03',
      gameTimestamp: '2018-01-03T00:00:00.000Z',
      gameDisplayTimestamp: '2018-01-03T00:00:00.000Z',
      marketSessions: {
        KR: { phase: 'opened', tradingDate: '2018-01-03' },
        US: { phase: 'preopen', tradingDate: null },
      },
      guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true },
    },
    version: 12,
  })))
})

test('market rows show known price and red/blue previous-close change', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByLabel(/현재 날짜/)).toContainText('2018. 01. 03. (수)')
  await expect(page.getByLabel(/현재 날짜/)).toContainText('09:00')

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).click()
  await expect(page.getByText(/국내장 장중 · 미국장 개장 전/)).toBeVisible()

  const rising = page.getByRole('button', { name: '영진전자 주문 거래 열기' })
  const risingQuote = rising.locator('.asset-list-quote')
  await expect(risingQuote.locator('strong')).toHaveText('2,627,000원')
  await expect(risingQuote.locator('small')).toHaveText('+2.98%')
  await expect(risingQuote.locator('small')).toHaveClass(/positive/)

  const falling = page.getByRole('button', { name: '새봄네트웍스 주문 거래 열기' })
  const fallingQuote = falling.locator('.asset-list-quote')
  await expect(fallingQuote.locator('strong')).toHaveText('876,000원')
  await expect(fallingQuote.locator('small')).toHaveText('-1.02%')
  await expect(fallingQuote.locator('small')).toHaveClass(/negative/)

  const colors = await page.evaluate(() => {
    const risingRow = document.querySelector('.asset-list-quote:has(> small.positive)')
    const fallingRow = document.querySelector('.asset-list-quote:has(> small.negative)')
    const risingPrice = risingRow?.querySelector('strong')
    const risingRate = risingRow?.querySelector('small')
    const fallingPrice = fallingRow?.querySelector('strong')
    const fallingRate = fallingRow?.querySelector('small')
    return {
      risingPrice: risingPrice ? getComputedStyle(risingPrice).color : null,
      risingRate: risingRate ? getComputedStyle(risingRate).color : null,
      fallingPrice: fallingPrice ? getComputedStyle(fallingPrice).color : null,
      fallingRate: fallingRate ? getComputedStyle(fallingRate).color : null,
    }
  })
  expect(colors.risingPrice).toBe('rgb(240, 68, 82)')
  expect(colors.risingRate).toBe('rgb(240, 68, 82)')
  expect(colors.fallingPrice).toBe('rgb(57, 120, 232)')
  expect(colors.fallingRate).toBe('rgb(57, 120, 232)')
})
