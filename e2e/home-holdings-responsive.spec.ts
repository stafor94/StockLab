import { expect, test } from '@playwright/test'

const HOLDING_SAVE = {
  state: {
    schemaVersion: 13,
    gameDate: '2018-01-03',
    gameTimestamp: '2018-01-02T15:00:00.000Z',
    gameDisplayTimestamp: '2018-01-02T15:00:00.000Z',
    marketSessions: {
      KR: { phase: 'preopen', tradingDate: '2018-01-03' },
      US: { phase: 'preopen', tradingDate: '2018-01-03' },
    },
    positions: [
      { assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 140, averagePrice: 1000 },
      { assetId: 'K002', market: 'KR', currency: 'KRW', quantity: 120, averagePrice: 1000 },
      { assetId: 'K003', market: 'KR', currency: 'KRW', quantity: 100, averagePrice: 1000 },
      { assetId: 'K004', market: 'KR', currency: 'KRW', quantity: 80, averagePrice: 1000 },
    ],
    guidance: {
      tutorialStatus: 'skipped',
      experienced: [],
      checklistCollapsed: true,
      skipOrderConfirmationShown: true,
      seenLoanPaymentFailures: 0,
    },
  },
  version: 13,
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

test('Home holdings use a single three-card row only on phone portrait', async ({ page }, testInfo) => {
  await page.addInitScript((save) => localStorage.setItem('stocklab.save', JSON.stringify(save)), HOLDING_SAVE)
  await page.goto('./')

  const cards = page.locator('.home-holdings-grid > [data-home-holding]')
  await expect(cards).toHaveCount(4)

  if (!testInfo.project.name.startsWith('mobile-')) {
    for (let index = 0; index < 4; index += 1) await expect(cards.nth(index)).toBeVisible()
    return
  }

  for (let index = 0; index < 3; index += 1) await expect(cards.nth(index)).toBeVisible()
  await expect(cards.nth(3)).toBeHidden()

  const portraitBoxes = await Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()))
  const firstY = portraitBoxes[0]?.y ?? 0
  for (const box of portraitBoxes.slice(1)) expect(Math.abs((box?.y ?? 0) - firstY)).toBeLessThanOrEqual(1)

  const portraitColumns = await page.locator('.home-holdings-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  expect(portraitColumns).toBe(3)
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: 800, height: 390 })
  await expect(cards.nth(3)).toBeVisible()
  const landscapeColumns = await page.locator('.home-holdings-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  expect(landscapeColumns).toBe(4)
  await expectNoHorizontalOverflow(page)
})
