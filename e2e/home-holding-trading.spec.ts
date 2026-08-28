import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: {
      schemaVersion: 13,
      gameDate: '2018-01-03',
      gameTimestamp: '2018-01-02T15:00:00.000Z',
      gameDisplayTimestamp: '2018-01-02T15:00:00.000Z',
      marketSessions: {
        KR: { phase: 'preopen', tradingDate: '2018-01-03' },
        US: { phase: 'preopen', tradingDate: '2018-01-03' },
      },
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 140, averagePrice: 1000 }],
      guidance: {
        tutorialStatus: 'skipped',
        experienced: [],
        checklistCollapsed: true,
        skipOrderConfirmationShown: true,
        seenLoanPaymentFailures: 0,
      },
    },
    version: 13,
  })))
})

test('opens the shared buy-sell dialog directly from a Home holding card', async ({ page }) => {
  await page.goto('./')

  const homeNav = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '홈' })
  const holdingCard = page.locator('[data-home-holding="K001"]')
  await expect(holdingCard).toBeVisible()
  await expect(holdingCard).toHaveAttribute('type', 'button')
  await expect(holdingCard).toHaveAttribute('aria-label', /주문 거래 열기/)

  await holdingCard.click()

  const tradingDialog = page.getByRole('dialog', { name: /주문 거래/ })
  await expect(tradingDialog).toBeVisible()
  await expect(tradingDialog.getByRole('button', { name: '매수' })).toBeVisible()
  await expect(tradingDialog.getByRole('button', { name: '매도' })).toBeVisible()
  await expect(homeNav).toHaveAttribute('aria-current', 'page')

  await tradingDialog.getByRole('button', { name: '주문 거래 닫기' }).click()
  await expect(tradingDialog).toHaveCount(0)
})
