import { expect, test } from '@playwright/test'

const TYPOGRAPHY_SAVE = {
  state: {
    schemaVersion: 13,
    gameDate: '2018-01-03',
    gameTimestamp: '2018-01-03T00:00:00.000Z',
    gameDisplayTimestamp: '2018-01-03T00:00:00.000Z',
    marketSessions: {
      KR: { phase: 'opened', tradingDate: '2018-01-03' },
      US: { phase: 'preopen', tradingDate: null },
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

const mobileViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 480, height: 900 },
]

async function expectFontSizeAtLeast(locator: import('@playwright/test').Locator, minimum: number) {
  await expect(locator).toBeVisible()
  const fontSize = await locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(fontSize).toBeGreaterThanOrEqual(minimum)
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

async function expectSameRow(locators: import('@playwright/test').Locator[]) {
  const boxes = await Promise.all(locators.map((locator) => locator.boundingBox()))
  const firstY = boxes[0]?.y ?? 0
  for (const box of boxes.slice(1)) expect(Math.abs((box?.y ?? 0) - firstY)).toBeLessThanOrEqual(1)
}

async function openMarket(page: import('@playwright/test').Page) {
  await page.getByRole('navigation', { name: '주 메뉴' }).getByText('시장', { exact: true }).click()
  await expect(page.locator('.asset-list-row').first()).toBeVisible()
}

async function openHome(page: import('@playwright/test').Page) {
  await page.getByRole('navigation', { name: '주 메뉴' }).getByText('홈', { exact: true }).click()
  await expect(page.locator('.home-dashboard')).toBeVisible()
}

test('mobile typography is readable at target widths without breaking Home or Market density', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Viewport matrix is exercised once; responsive CSS is width-based.')

  await page.addInitScript((save) => localStorage.setItem('stocklab.save', JSON.stringify(save)), TYPOGRAPHY_SAVE)
  await page.goto('./')

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport)
    await openHome(page)

    await expectFontSizeAtLeast(page.locator('.app-header-brand h1'), 22)
    await expectFontSizeAtLeast(page.locator('.app-header-brand span'), 13)
    await expectFontSizeAtLeast(page.locator('.app-game-date strong'), 16)
    await expectFontSizeAtLeast(page.locator('.header-help-button'), 15)
    await expectFontSizeAtLeast(page.locator('.home-dashboard .section-kicker').first(), 14)
    await expectFontSizeAtLeast(page.locator('.investment-headline > span:first-child'), 14)
    await expectFontSizeAtLeast(page.locator('.market-status-line > div > span'), 14)

    const indexCards = page.locator('.market-index-grid .market-index-quote')
    await expect(indexCards.first()).toBeVisible()
    await expectFontSizeAtLeast(indexCards.first().locator('.market-index-heading span'), 13)
    await expectFontSizeAtLeast(indexCards.first().locator('.market-index-value'), 15)
    await expectFontSizeAtLeast(indexCards.first().locator('.market-index-change'), 14)
    await expectSameRow([indexCards.nth(0), indexCards.nth(1), indexCards.nth(2)])

    const holdingCards = page.locator('.home-holdings-grid > [data-home-holding]')
    await expect(holdingCards.first()).toBeVisible()
    await expectFontSizeAtLeast(holdingCards.first().locator('.home-holding-value'), 14)
    await expectSameRow([holdingCards.nth(0), holdingCards.nth(1), holdingCards.nth(2)])

    const navLabelMinimum = viewport.width >= 390 ? 15 : 13.5
    await expectFontSizeAtLeast(page.locator('.app-navigation button span').first(), navLabelMinimum)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`typography-home-${viewport.width}.png`), fullPage: true })

    await openMarket(page)
    await expectFontSizeAtLeast(page.locator('.screen-title-section .section-header p'), 14)
    await expectFontSizeAtLeast(page.locator('.market-flow-guide'), 14)
    await expectFontSizeAtLeast(page.locator('.asset-filter-tabs button').first(), 15)
    await expectFontSizeAtLeast(page.locator('.favorite-filter-toggle'), 15)
    await expectFontSizeAtLeast(page.getByRole('searchbox', { name: '종목 검색' }), 15)
    await expectFontSizeAtLeast(page.getByRole('combobox', { name: '산업군' }), 15)

    const firstRow = page.locator('.asset-list-row').first()
    await expectFontSizeAtLeast(firstRow.locator('.asset-list-copy strong'), 17)
    await expectFontSizeAtLeast(firstRow.locator('.asset-list-copy small'), 13)
    await expectFontSizeAtLeast(firstRow.locator('.asset-list-quote > strong'), 15)
    await expectFontSizeAtLeast(firstRow.locator('.asset-list-quote > small'), 14)
    await expect(firstRow.locator('.asset-list-copy strong')).toHaveCSS('white-space', 'nowrap')
    await expectSameRow([page.locator('.asset-filter-tabs'), page.locator('.favorite-filter-toggle')])
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`typography-market-${viewport.width}.png`), fullPage: true })
  }

  await page.setViewportSize({ width: 1280, height: 800 })
  await openHome(page)
  await expect(page.locator('.home-dashboard .section-header h2').first()).toHaveCSS('font-size', '18px')
  await expect(page.locator('.app-navigation button span').first()).toHaveCSS('font-size', '12px')
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('typography-home-1280.png'), fullPage: true })

  await openMarket(page)
  await expect(page.locator('.screen-title-section .section-header h2')).toHaveCSS('font-size', '20px')
  await expect(page.locator('.asset-list-copy strong').first()).toHaveCSS('font-size', '15px')
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('typography-market-1280.png'), fullPage: true })
})
