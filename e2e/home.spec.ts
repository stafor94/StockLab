import { expect, test } from '@playwright/test'

const INDEX_FIXTURES = [
  { id: 'KOSPI', alias: '코스피', market: 'KR', dataPath: 'kr/KOSPI.json', base: 2480 },
  { id: 'KOSDAQ', alias: '코스닥', market: 'KR', dataPath: 'kr/KOSDAQ.json', base: 812 },
  { id: 'NASDAQ_COMPOSITE', alias: '나스닥 종합', market: 'US', dataPath: 'us/NASDAQ_COMPOSITE.json', base: 7007 },
] as const

function indexSeries(fixture: (typeof INDEX_FIXTURES)[number]) {
  const bar = (date: string, offset: number) => ({
    date,
    open: fixture.base + offset - 3,
    high: fixture.base + offset + 5,
    low: fixture.base + offset - 7,
    close: fixture.base + offset,
    volume: null,
  })
  return {
    schemaVersion: 1,
    id: fixture.id,
    alias: fixture.alias,
    market: fixture.market,
    source: {
      authoritativeProvider: 'E2E fixture',
      generatedAt: '2026-08-27T00:00:00.000Z',
      reference: 'https://fixture.invalid/market-index',
    },
    bars: [bar('2017-12-28', -10), bar('2017-12-29', -5), bar('2018-01-02', 0), bar('2018-01-03', 4)],
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('**/data/indices/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const relativePath = pathname.split('/data/indices/')[1]
    if (relativePath === 'manifest.json') {
      await route.fulfill({
        json: {
          schemaVersion: 1,
          indices: INDEX_FIXTURES.map(({ id, alias, market, dataPath }) => ({ id, alias, market, dataPath })),
        },
      })
      return
    }
    const fixture = INDEX_FIXTURES.find((item) => item.dataPath === relativePath)
    if (fixture) {
      await route.fulfill({ json: indexSeries(fixture) })
      return
    }
    await route.continue()
  })

  await page.addInitScript(() => {
    if (localStorage.getItem('stocklab.save')) return
    localStorage.setItem('stocklab.save', JSON.stringify({
      state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
      version: 10,
    }))
  })
})

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

test('keeps the core game actions and five-screen navigation available', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByText(/^v\d+\.\d+\.\d+$/)).toBeVisible()
  const gameClock = page.getByLabel(/현재 날짜/)
  await expect(gameClock).toContainText('2018. 01. 01. (월)')
  await expect(gameClock).toContainText('00:00')
  await expect(page.getByText('게임 날짜')).toHaveCount(0)
  await expect(page.getByText('10,000,000원').first()).toBeVisible()
  expect(await page.locator('.app-screen').innerText()).not.toContain('₩')
  await expect(page.getByText('내 투자')).toBeVisible()
  await expect(page.getByLabel('순자산')).toBeVisible()
  await expect(page.getByLabel('현금')).toBeVisible()
  await expect(page.getByLabel('대출')).toBeVisible()
  const summaryRow = page.locator('.investment-summary-row')
  await expect(summaryRow.getByText('원화', { exact: true })).toHaveCount(0)
  await expect(summaryRow.getByText('달러', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '오늘의 시장' })).toBeVisible()
  const majorIndices = page.getByLabel('주요 지수')
  await expect(majorIndices.locator('.market-index-quote')).toHaveCount(3)
  for (const name of ['코스피', '코스닥', '나스닥 종합']) {
    await expect(majorIndices.getByText(name, { exact: true })).toBeVisible()
  }
  await expect(majorIndices.locator('[data-market-index="DOW_JONES"]')).toHaveCount(0)
  await expect(majorIndices.getByText('다우존스', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '오늘의 뉴스' })).toHaveCount(0)
  const homeHoldingsSection = page.locator('.home-holdings-section')
  await expect(homeHoldingsSection.getByRole('heading', { name: '보유 종목' })).toBeVisible()
  await expect(homeHoldingsSection.getByText('보유 중인 종목이 없습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '도움말' })).toBeVisible()
  await expect(page.getByRole('button', { name: '설정' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  await expect(nav.getByRole('button')).toHaveCount(5)
  await expect(nav.getByRole('button', { name: '홈' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: /시장 보기/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expect(nav.getByRole('button', { name: /시장/ })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  await homeHoldingsSection.getByRole('button', { name: /전체보기/ }).click()
  await expect(page.getByText('내 투자').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '보유 종목' })).toBeVisible()
  await expect(nav.getByRole('button', { name: '포트폴리오' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  await expect(page.getByRole('dialog', { name: '시간 진행' })).toHaveCount(0)
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(progressDialog).toBeVisible()

  const krOpen = progressDialog.getByRole('button', { name: '국내장 시작' })
  await expect(krOpen).toBeEnabled()
  await krOpen.click()
  await expect(gameClock).toContainText('2018. 01. 02. (화)')
  await expect(gameClock).toContainText('09:00')
  await expect(progressDialog.getByText(/국내장 시작/)).toBeVisible()

  const krClose = progressDialog.getByRole('button', { name: '국내장 마감' })
  await expect(krClose).toBeEnabled()
  await krClose.click()
  await expect(gameClock).toContainText('15:29')
  await expect(progressDialog.getByText(/국내장 마감/)).toBeVisible()

  await progressDialog.getByRole('button', { name: '10×' }).click()
  await progressDialog.getByRole('button', { name: '자동진행' }).click()
  await expect(progressDialog.getByRole('button', { name: '일시정지' })).toBeVisible()
  await expect(gameClock).not.toContainText('15:29', { timeout: 2500 })
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

test('home holding cards keep valuation and performance metrics on compact rows', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('stocklab.save', JSON.stringify({
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
  await page.reload()

  const holdingCard = page.locator('[data-home-holding="K001"]')
  await expect(holdingCard).toBeVisible()

  const valueRow = holdingCard.locator('.home-holding-value-row')
  await expect(valueRow.getByText('평가금액', { exact: true })).toBeVisible()
  await expect(valueRow.locator('.home-holding-value')).toContainText('원')
  expect(await valueRow.evaluate((element) => getComputedStyle(element).display)).toBe('flex')

  const performanceRow = holdingCard.locator('.home-holding-performance')
  expect(await performanceRow.evaluate((element) => getComputedStyle(element).display)).toBe('flex')
  await expect(performanceRow.locator('span')).toContainText('%')
  await expect(performanceRow.locator('small')).toContainText('원')
  await expect(performanceRow).not.toContainText('수익률')
  await expect(performanceRow).not.toContainText('손익')
  await expectNoHorizontalOverflow(page)
})

test('settings reset refreshes mounted home UI back to the initial state', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '국내장 시작' }).click()
  await progressDialog.getByRole('button', { name: '국내장 마감' }).click()
  await expect(page.getByLabel(/현재 날짜/)).toContainText('2018. 01. 02. (화)')
  await expect(page.getByLabel(/현재 날짜/)).toContainText('15:29')
  await expect(progressDialog.getByText(/국내장 마감/)).toBeVisible()
  await progressDialog.getByRole('button', { name: '10×' }).click()
  await expect(progressDialog.getByRole('button', { name: '10×' })).toHaveAttribute('aria-pressed', 'true')
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  await expect(nav.getByRole('button', { name: '홈' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: '설정' }).click()
  const settings = page.getByRole('dialog', { name: '설정' })
  await expect(settings).toBeVisible()
  await settings.getByRole('button', { name: '처음부터 다시 시작' }).click()
  await expect(settings.getByText('게임을 정말 초기화할까요?')).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 400))
  await settings.getByRole('button', { name: '게임 초기화' }).click()

  await expect(settings).toHaveCount(0)
  await expect(page.getByLabel(/현재 날짜/)).toContainText('2018. 01. 01. (월)')
  await expect(page.getByLabel(/현재 날짜/)).toContainText('00:00')
  await expect(nav.getByRole('button', { name: '홈' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('10,000,000원').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const resetProgressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(resetProgressDialog.getByText(/다음 이벤트: 국내장 시작 · 2018\. 01\. 02\. \(화\) 09:00/)).toBeVisible()
  await expect(resetProgressDialog.getByRole('button', { name: '국내장 시작' })).toBeEnabled()
  await expect(resetProgressDialog.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true')
  await expect(resetProgressDialog.getByRole('button', { name: '10×' })).toHaveAttribute('aria-pressed', 'false')
})

test('game progress controls stay out of the home layout until requested', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('dialog', { name: '시간 진행' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '게임 진행 열기' })).toBeVisible()

  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(progressDialog).toBeVisible()
  await expect(progressDialog.getByRole('button', { name: '국내장 시작' })).toBeVisible()

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
  for (const name of ['도움말', '설정']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
  const gameClock = page.locator('.app-game-date')
  const gameClockBox = await gameClock.boundingBox()
  const viewport = page.viewportSize()
  expect(gameClockBox?.width ?? 0).toBeGreaterThan(0)
  expect((gameClockBox?.x ?? 0) + (gameClockBox?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)
  await expect(gameClock).toContainText('2018. 01. 01. (월)')
  await expect(gameClock).toContainText('00:00')

  const summaryRow = page.locator('.investment-summary-row')
  const headlineBlock = page.locator('.investment-headline')
  const headline = page.locator('.financial-amount-display').first()
  const netAssets = page.locator('.investment-net-compact')
  const cash = page.locator('.investment-cash-compact')
  const loan = page.locator('.investment-loan-compact')
  await expect(summaryRow.locator(':scope > div')).toHaveCount(4)
  const headlineBlockBox = await headlineBlock.boundingBox()
  const headlineBox = await headline.boundingBox()
  const netAssetsBox = await netAssets.boundingBox()
  const cashBox = await cash.boundingBox()
  const loanBox = await loan.boundingBox()
  expect(Math.abs((netAssetsBox?.y ?? 0) - (headlineBlockBox?.y ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((cashBox?.y ?? 0) - (headlineBlockBox?.y ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((loanBox?.y ?? 0) - (headlineBlockBox?.y ?? 0))).toBeLessThanOrEqual(1)
  expect((headlineBox?.x ?? 0) + (headlineBox?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)
  const headlineFontSize = await headline.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  const netAssetFontSize = await netAssets.locator('strong').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  const cashFontSize = await cash.locator('strong').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  const loanFontSize = await loan.locator('strong').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(headlineFontSize).toBeLessThanOrEqual(31)
  expect(netAssetFontSize).toBeLessThan(headlineFontSize)
  expect(cashFontSize).toBeLessThan(headlineFontSize)
  expect(loanFontSize).toBeLessThan(headlineFontSize)
  expect(netAssetsBox?.x ?? 0).toBeGreaterThan((headlineBlockBox?.x ?? 0) + (headlineBlockBox?.width ?? 0) - 1)
  expect(cashBox?.x ?? 0).toBeGreaterThan((netAssetsBox?.x ?? 0) + (netAssetsBox?.width ?? 0) - 1)
  expect(loanBox?.x ?? 0).toBeGreaterThan((cashBox?.x ?? 0) + (cashBox?.width ?? 0) - 1)
  expect((loanBox?.x ?? 0) + (loanBox?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)

  const indexGrid = page.getByLabel('주요 지수')
  const indexCards = indexGrid.locator('.market-index-quote')
  await expect(indexCards).toHaveCount(3)
  await expect(indexGrid).toHaveAttribute('data-index-count', '3')
  await expect(indexGrid.locator('[data-market-index="DOW_JONES"]')).toHaveCount(0)
  const indexSpacing = await indexGrid.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
    }
  })
  expect(indexSpacing.paddingLeft).toBeGreaterThanOrEqual(6)
  expect(indexSpacing.paddingRight).toBeGreaterThanOrEqual(6)
  const indexBoxes = await Promise.all(Array.from({ length: 3 }, (_, index) => indexCards.nth(index).boundingBox()))
  const firstIndexY = indexBoxes[0]?.y ?? 0
  for (const box of indexBoxes.slice(1)) expect(Math.abs((box?.y ?? 0) - firstIndexY)).toBeLessThanOrEqual(1)

  await expect(page.getByRole('heading', { name: '오늘의 뉴스' })).toHaveCount(0)
  await expect(page.locator('.home-holdings-section').getByRole('heading', { name: '보유 종목' })).toBeVisible()
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