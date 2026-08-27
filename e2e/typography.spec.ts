import { expect, test, type Locator, type Page } from '@playwright/test'

async function expectFontSizeAtLeast(locator: Locator, minimum: number) {
  await expect(locator).toBeVisible()
  const fontSize = await locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(fontSize).toBeGreaterThanOrEqual(minimum)
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
    version: 10,
  })))
})

test('keeps primary user-facing text readable without responsive overflow', async ({ page }) => {
  await page.goto('./')
  await expectNoHorizontalOverflow(page)

  await expectFontSizeAtLeast(page.locator('.app-header-brand span'), 12)
  await expectFontSizeAtLeast(page.locator('.app-game-date > span'), 12)
  await expectFontSizeAtLeast(page.locator('.app-game-date strong'), 15)
  await expectFontSizeAtLeast(page.locator('.app-game-date time'), 15)
  await expectFontSizeAtLeast(page.getByRole('button', { name: '도움말' }), 13)
  await expectFontSizeAtLeast(page.locator('.app-navigation button span').first(), 12)

  await expectFontSizeAtLeast(page.locator('.home-dashboard .section-kicker').first(), 12)
  await expectFontSizeAtLeast(page.locator('.investment-performance'), 13)
  await expectFontSizeAtLeast(page.locator('.investment-net-compact > span'), 12)
  await expectFontSizeAtLeast(page.locator('.investment-cash-compact > span'), 12)
  await expectFontSizeAtLeast(page.locator('.investment-loan-compact > span'), 12)
  await expectFontSizeAtLeast(page.getByRole('heading', { name: '오늘의 시장' }), 18)
  await expectFontSizeAtLeast(page.locator('.market-status-line strong'), 14)
  await expectFontSizeAtLeast(page.locator('.market-status-line span'), 12)
  await expectFontSizeAtLeast(page.locator('.market-index-heading span').first(), 12)
  await expectFontSizeAtLeast(page.locator('.market-index-value').first(), 13)
  await expectFontSizeAtLeast(page.locator('.market-index-change').first(), 12)
  await expectNoHorizontalOverflow(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expectFontSizeAtLeast(page.getByRole('heading', { name: '시장' }), 20)
  await expectFontSizeAtLeast(page.locator('.market-flow-guide'), 12)
  await expectFontSizeAtLeast(page.locator('.favorite-filter-toggle'), 13)
  await expectFontSizeAtLeast(page.locator('.asset-list-copy strong').first(), 15)
  await expectFontSizeAtLeast(page.locator('.asset-list-copy small').first(), 12)
  await expectFontSizeAtLeast(page.locator('.asset-list-quote > strong').first(), 13)
  await expectFontSizeAtLeast(page.locator('.asset-list-quote > small').first(), 12)
  await expectNoHorizontalOverflow(page)

  await navigation.getByRole('button', { name: '포트폴리오' }).click()
  await expect(page.getByRole('heading', { name: '보유 종목' })).toBeVisible()
  await expectFontSizeAtLeast(page.locator('.portfolio-core-metrics span').first(), 12)
  await expectFontSizeAtLeast(page.locator('.portfolio-core-metrics strong').first(), 15)
  await expectNoHorizontalOverflow(page)

  await navigation.getByRole('button', { name: '자산' }).click()
  await expect(page.getByRole('heading', { name: '자산' })).toBeVisible()
  await expectFontSizeAtLeast(page.getByRole('heading', { name: '자산' }), 20)
  await expectFontSizeAtLeast(page.locator('.exchange-header h2'), 20)
  await expectFontSizeAtLeast(page.locator('.exchange-header p'), 13)
  await expectFontSizeAtLeast(page.locator('.fx-source-badge span'), 12)
  await expectFontSizeAtLeast(page.locator('.fx-source-badge strong'), 13)
  await expectFontSizeAtLeast(page.locator('.cash-balance-grid span').first(), 12)
  await expectFontSizeAtLeast(page.locator('.exchange-input'), 13)
  await expectFontSizeAtLeast(page.locator('.exchange-policy > p'), 12)
  await expectNoHorizontalOverflow(page)
})
