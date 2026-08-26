import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
    version: 10,
  })))
})

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

test('keeps the core game actions and five-screen navigation available', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByText('v0.19.2')).toBeVisible()
  await expect(page.getByLabel('현재 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('게임 날짜')).toHaveCount(0)
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('내 투자')).toBeVisible()
  await expect(page.getByLabel('순자산')).toBeVisible()
  await expect(page.getByLabel('현금')).toBeVisible()
  await expect(page.getByText('원화')).toBeVisible()
  await expect(page.getByText('달러')).toBeVisible()
  await expect(page.getByRole('heading', { name: '오늘의 시장' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  await expect(nav.getByRole('button')).toHaveCount(5)
  await expect(nav.getByRole('button', { name: '홈' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: /시장 보기/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expect(nav.getByRole('button', { name: /시장/ })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  await page.getByRole('button', { name: /전체보기/ }).click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await expect(nav.getByRole('button', { name: /뉴스/ })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  await expect(page.getByRole('dialog', { name: '시간 진행' })).toHaveCount(0)
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(progressDialog).toBeVisible()

  const nextDay = progressDialog.getByRole('button', { name: '다음 날' })
  await expect(nextDay).toBeEnabled()
  await nextDay.click()
  await expect(page.getByLabel('현재 날짜')).toContainText('2018-01-02')

  const openMarket = progressDialog.getByRole('button', { name: '장 시작' })
  await expect(openMarket).toBeEnabled()
  await openMarket.click()
  await expect(progressDialog.getByText(/당일 시가가 공개되었습니다/)).toBeVisible()
  const closeMarket = progressDialog.getByRole('button', { name: '장 마감' })
  await expect(closeMarket).toBeEnabled()
  await closeMarket.click()
  await expect(progressDialog.getByText(/당일 OHLC가 공개/)).toBeVisible()

  await progressDialog.getByRole('button', { name: '10×' }).click()
  await progressDialog.getByRole('button', { name: '자동진행' }).click()
  await expect(progressDialog.getByRole('button', { name: '일시정지' })).toBeVisible()
  await expect(page.getByLabel('현재 날짜')).not.toContainText('2018-01-02', { timeout: 2500 })
  const pause = progressDialog.getByRole('button', { name: '일시정지' })
  if (await pause.isVisible()) await pause.click()
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()
  await expect(progressDialog).toHaveCount(0)

  await nav.getByRole('button', { name: /뉴스/ }).click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await nav.getByRole('button', { name: '포트폴리오' }).click()
  await expect(page.getByText('내 투자').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '보유 종목' })).toBeVisible()
  await nav.getByRole('button', { name: '자산' }).click()
  await expect(page.getByRole('heading', { name: '자산' })).toBeVisible()
  await page.getByRole('button', { name: 'WS은행 대출' }).click()
  await expect(page.getByRole('heading', { name: 'WS은행 대출' })).toBeVisible()
})

test('game progress controls stay out of the home layout until requested', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('dialog', { name: '시간 진행' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '게임 진행 열기' })).toBeVisible()

  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(progressDialog).toBeVisible()
  await expect(progressDialog.getByRole('button', { name: '다음 날' })).toBeVisible()

  await progressDialog.press('Escape')
  await expect(progressDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '게임 진행 열기' })).toBeFocused()
})

test('responsive layout avoids overflow and keeps touch targets usable', async ({ page }, testInfo) => {
  await page.goto('./')
  await expectNoHorizontalOverflow(page)
  const navigationButtons = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button')
  const count = await navigationButtons.count()
  for (let index = 0; index < count; index += 1) {
    const box = await navigationButtons.nth(index).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }

  const summaryRow = page.locator('.investment-summary-row')
  const headlineBlock = page.locator('.investment-headline')
  const headline = page.locator('.financial-amount-display').first()
  const netAssets = page.locator('.investment-net-compact')
  const cash = page.locator('.investment-cash-compact')
  await expect(summaryRow.locator(':scope > div')).toHaveCount(3)
  const headlineBlockBox = await headlineBlock.boundingBox()
  const headlineBox = await headline.boundingBox()
  const netAssetsBox = await netAssets.boundingBox()
  const cashBox = await cash.boundingBox()
  const viewport = page.viewportSize()
  expect(Math.abs((netAssetsBox?.y ?? 0) - (headlineBlockBox?.y ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((cashBox?.y ?? 0) - (headlineBlockBox?.y ?? 0))).toBeLessThanOrEqual(1)
  expect((headlineBox?.x ?? 0) + (headlineBox?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)
  const headlineFontSize = await headline.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  const netAssetFontSize = await netAssets.locator('strong').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  const cashFontSize = await cash.locator('strong').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(headlineFontSize).toBeLessThanOrEqual(31)
  expect(netAssetFontSize).toBeLessThan(headlineFontSize)
  expect(netAssetFontSize).toBeGreaterThanOrEqual(headlineFontSize * 0.5)
  expect(cashFontSize).toBeGreaterThanOrEqual(headlineFontSize * 0.48)
  expect(netAssetsBox?.x ?? 0).toBeGreaterThan((headlineBlockBox?.x ?? 0) + (headlineBlockBox?.width ?? 0) - 1)
  expect(cashBox?.x ?? 0).toBeGreaterThan((netAssetsBox?.x ?? 0) + (netAssetsBox?.width ?? 0) - 1)
  expect((cashBox?.x ?? 0) + (cashBox?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)

  if (testInfo.project.name.startsWith('mobile-') && viewport) {
    const newsHeadingBox = await page.getByRole('heading', { name: '오늘의 뉴스' }).boundingBox()
    expect((newsHeadingBox?.y ?? viewport.height) + (newsHeadingBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height - 66)
  }
  await page.screenshot({ path: testInfo.outputPath(`home-viewport-${testInfo.project.name}.png`) })

  const progressTrigger = page.getByRole('button', { name: '게임 진행 열기' })
  const triggerBox = await progressTrigger.boundingBox()
  expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44)
  await progressTrigger.click()
  await expect(page.getByRole('dialog', { name: '시간 진행' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath(`game-progress-open-${testInfo.project.name}.png`), fullPage: true })
  await page.getByRole('button', { name: '게임 진행 닫기' }).click()

  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: /시장/ }).click()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '포트폴리오' }).click()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: /뉴스/ }).click()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '자산' }).click()
  await expectNoHorizontalOverflow(page)

  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '홈' }).click()
  await page.screenshot({ path: testInfo.outputPath(`home-${testInfo.project.name}.png`), fullPage: true })
})
