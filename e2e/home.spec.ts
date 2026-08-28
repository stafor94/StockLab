import { expect, test, type Locator } from '@playwright/test'

async function expectAtLeast(locator: Locator, count: number) {
  await expect.poll(async () => locator.count()).toBeGreaterThanOrEqual(count)
}

async function expectTapTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.width).toBeGreaterThanOrEqual(44)
}

async function expectInsideViewport(locator: Locator, viewportHeight: number) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight)
}

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
  await expect(page.getByText('v0.29.0')).toBeVisible()
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
  const investmentSummary = page.locator('.investment-summary')
  const summaryGrid = page.locator('.investment-summary-grid')
  const summaryBox = await investmentSummary.boundingBox()
  const summaryGridBox = await summaryGrid.boundingBox()
  expect(summaryBox).not.toBeNull()
  expect(summaryGridBox).not.toBeNull()
  expect(Math.abs(summaryBox!.y - summaryGridBox!.y)).toBeLessThanOrEqual(3)
  const portfolioHeadline = page.locator('.investment-summary .investment-total')
  const portfolioHeadlineFontSize = await portfolioHeadline.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(portfolioHeadlineFontSize).toBeLessThanOrEqual(36)
  const metrics = page.locator('.investment-summary-grid .investment-metric')
  await expect(metrics).toHaveCount(3)
  const metricBoxes = await metrics.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(Math.max(...metricBoxes.map((box) => box.y)) - Math.min(...metricBoxes.map((box) => box.y))).toBeLessThanOrEqual(3)
  await expect(page.getByText('오늘의 시장')).toBeVisible()
  await expect(page.getByLabel('KOSPI 지수')).toBeVisible()
  await expect(page.getByLabel('KOSDAQ 지수')).toBeVisible()
  await expect(page.getByLabel('Nasdaq Composite 지수')).toBeVisible()
  await expect(page.getByLabel('Dow Jones 지수')).toBeVisible()
  const marketIndexGrid = page.locator('.market-index-grid')
  const marketIndexCards = marketIndexGrid.locator('.market-index-card')
  await expect(marketIndexCards).toHaveCount(4)
  const cardBoxes = await marketIndexCards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(Math.max(...cardBoxes.map((box) => box.y)) - Math.min(...cardBoxes.map((box) => box.y))).toBeLessThanOrEqual(3)
  await expect(page.getByText('오늘의 뉴스')).toBeVisible()
  await expect(page.getByText('기업 이벤트')).toBeVisible()
  await expect(page.getByText('다음 행동')).toBeVisible()
  await expect(page.getByText('첫 게임 추천')).toHaveCount(0)
  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  for (const label of ['홈', '시장', '포트폴리오', '뉴스', '자산']) {
    await expect(navigation.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible()
  }
  await expectTapTarget(navigation.getByRole('button', { name: /^홈/ }))
  await expectNoHorizontalOverflow(page)
})

test('important news stops manual time travel until it is acknowledged', async ({ page }) => {
  await page.goto('./')
  const progressTrigger = page.getByRole('button', { name: '게임 진행 열기' })
  await progressTrigger.click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '+1년' }).click()
  const confirmation = page.getByRole('dialog', { name: '중요 뉴스 확인' })
  await expect(confirmation).toBeVisible()
  await expect(confirmation).toContainText('중요 뉴스')
  await expect(page.getByText('2019. 01. 03. (목)')).toBeVisible()
  await confirmation.getByRole('button', { name: '확인' }).click()
  await expect(confirmation).toHaveCount(0)
})

test('market navigation opens the market screen', async ({ page }) => {
  await page.goto('./')
  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /^시장/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expect(page.getByPlaceholder('종목 검색')).toBeVisible()
})

test('portfolio navigation opens the portfolio screen', async ({ page }) => {
  await page.goto('./')
  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: '포트폴리오' }).click()
  await expect(page.getByRole('heading', { name: '보유 종목' })).toBeVisible()
})

test('news navigation opens the news screen', async ({ page }) => {
  await page.goto('./')
  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: '뉴스' }).click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
})

test('assets navigation opens the asset screen', async ({ page }) => {
  await page.goto('./')
  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: '자산' }).click()
  await expect(page.getByRole('heading', { name: '자산' })).toBeVisible()
})

test('screen content remains responsive without horizontal overflow', async ({ page }) => {
  await page.goto('./')
  await expectNoHorizontalOverflow(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  for (const label of ['시장', '포트폴리오', '뉴스', '자산']) {
    await navigation.getByRole('button', { name: new RegExp(`^${label}`) }).click()
    await expectNoHorizontalOverflow(page)
  }
})

test('main mobile sections are reachable before the fixed navigation', async ({ page }) => {
  const viewport = page.viewportSize()
  if (!viewport || viewport.width >= 640) test.skip()

  await page.goto('./')
  const todayNews = page.getByText('오늘의 뉴스')
  await expect(todayNews).toBeVisible()
  await todayNews.scrollIntoViewIfNeeded()
  await expectInsideViewport(todayNews, viewport.height)
})

test('game progress controls stay out of the home layout until requested', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.game-progress-sheet')).toHaveCount(0)

  const progressTrigger = page.getByRole('button', { name: '게임 진행 열기' })
  await expectTapTarget(progressTrigger)
  await progressTrigger.click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(progressDialog).toBeVisible()
  await expect(progressDialog.getByRole('button', { name: '+1일' })).toBeVisible()

  await progressDialog.press('Escape')
  await expect(progressDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '게임 진행 열기' })).toBeFocused()
})

test('game progress dialog supports all configured speeds', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(progressDialog).toBeVisible()
  for (const label of ['1×', '2×', '5×', '10×', '30×']) {
    await expect(progressDialog.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
})

test('home visual baseline', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true })
})
