import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

test('keeps the core game actions and five-screen navigation available', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(page.getByText('v0.14.0')).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('₩10,000,000').first()).toBeVisible()
  await expect(page.getByText('내 투자')).toBeVisible()
  await expect(page.getByText('순자산')).toBeVisible()
  await expect(page.getByText('원화')).toBeVisible()
  await expect(page.getByText('달러')).toBeVisible()
  await expect(page.getByRole('heading', { name: '오늘의 시장' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  await expect(nav.getByRole('button')).toHaveCount(5)
  await expect(nav.getByRole('button', { name: '홈' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: /시장 보기/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expect(nav.getByRole('button', { name: '시장' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  await page.getByRole('button', { name: /전체보기/ }).click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await expect(nav.getByRole('button', { name: '뉴스' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  const nextDay = page.getByRole('button', { name: '다음 날' })
  await expect(nextDay).toBeEnabled()
  await nextDay.click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')

  const openMarket = page.getByRole('button', { name: '장 시작' })
  await expect(openMarket).toBeEnabled()
  await openMarket.click()
  await expect(page.getByText(/당일 시가가 공개되었습니다/)).toBeVisible()
  const closeMarket = page.getByRole('button', { name: '장 마감' })
  await expect(closeMarket).toBeEnabled()
  await closeMarket.click()
  await expect(page.getByText(/당일 OHLC가 공개/)).toBeVisible()

  await page.getByRole('button', { name: '10×' }).click()
  await page.getByRole('button', { name: '자동진행' }).click()
  await expect(page.getByRole('button', { name: '일시정지' })).toBeVisible()
  await expect(page.getByLabel('게임 날짜')).not.toContainText('2018-01-02', { timeout: 2500 })
  const pause = page.getByRole('button', { name: '일시정지' })
  if (await pause.isVisible()) await pause.click()

  await nav.getByRole('button', { name: '뉴스' }).click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await nav.getByRole('button', { name: '포트폴리오' }).click()
  await expect(page.getByText('내 투자').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '보유 종목' })).toBeVisible()
  await nav.getByRole('button', { name: '자산' }).click()
  await expect(page.getByRole('heading', { name: '자산' })).toBeVisible()
  await page.getByRole('button', { name: 'WS은행 대출' }).click()
  await expect(page.getByRole('heading', { name: 'WS은행 대출' })).toBeVisible()
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
  const headline = page.locator('.financial-amount-display').first()
  const headlineBox = await headline.boundingBox()
  const viewport = page.viewportSize()
  expect((headlineBox?.x ?? 0) + (headlineBox?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)

  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '시장' }).click()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '포트폴리오' }).click()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '뉴스' }).click()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '자산' }).click()
  await expectNoHorizontalOverflow(page)

  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '홈' }).click()
  await page.screenshot({ path: testInfo.outputPath(`home-${testInfo.project.name}.png`), fullPage: true })
})
