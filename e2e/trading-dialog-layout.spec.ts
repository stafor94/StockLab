import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('stocklab.save')) return
    localStorage.setItem('stocklab.save', JSON.stringify({
      state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
      version: 10,
    }))
  })
})

async function advanceToFirstTradingDate(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '다음 날' }).click()
  await expect(page.getByLabel('현재 날짜')).toContainText('2018-01-02')
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()
}

function verticalSpread(values: number[]) {
  if (values.length === 0) return 0
  return Math.max(...values) - Math.min(...values)
}

async function expectDialogFits(dialog: import('@playwright/test').Locator) {
  const layout = await dialog.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    titleClientWidth: element.querySelector('.trading-dialog-header h2')?.clientWidth ?? 0,
    titleScrollWidth: element.querySelector('.trading-dialog-header h2')?.scrollWidth ?? 0,
  }))

  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1)
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
  expect(layout.titleClientWidth).toBeGreaterThan(0)
  expect(layout.titleScrollWidth).toBeLessThanOrEqual(layout.titleClientWidth + 1)
}

async function fontSizePx(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
}

test('trading dialog selection and focused order screens fit responsive viewports', async ({ page }, testInfo) => {
  await page.goto('./')
  await advanceToFirstTradingDate(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).click()
  await page.locator('.asset-list-row').first().click()

  const dialog = page.getByRole('dialog', { name: /주문 거래/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.trading-dialog-header h2')).toBeVisible()

  const sideSelector = dialog.getByLabel('주문 유형 선택')
  const buyAction = sideSelector.getByRole('button', { name: '매수', exact: true })
  const sellAction = sideSelector.getByRole('button', { name: '매도', exact: true })
  await expect(buyAction).toBeVisible()
  await expect(sellAction).toBeVisible()
  await expectDialogFits(dialog)

  const selectionLayout = await sideSelector.evaluate((element) => ({
    tops: Array.from(element.querySelectorAll('.trading-side-actions button')).map((button) => button.getBoundingClientRect().top),
    widths: Array.from(element.querySelectorAll('.trading-side-actions button')).map((button) => button.getBoundingClientRect().width),
    clipped: Array.from(element.querySelectorAll('.trading-side-actions button')).some((button) => button.scrollWidth > button.clientWidth + 1),
  }))
  expect(verticalSpread(selectionLayout.tops)).toBeLessThanOrEqual(1)
  expect(verticalSpread(selectionLayout.widths)).toBeLessThanOrEqual(1)
  expect(selectionLayout.clipped).toBe(false)
  expect(await fontSizePx(sideSelector.locator('.trading-side-selector-copy strong'))).toBeGreaterThanOrEqual(15)
  expect(await fontSizePx(sideSelector.locator('.trading-side-selector-copy span'))).toBeGreaterThanOrEqual(11)
  expect(await fontSizePx(buyAction.locator('strong'))).toBeGreaterThanOrEqual(15)
  expect(await fontSizePx(buyAction.locator('span'))).toBeGreaterThanOrEqual(10.5)

  await buyAction.click()
  await expect(dialog.getByRole('button', { name: '주문 유형 선택으로 돌아가기' })).toBeVisible()
  await expect(dialog.locator('.trade-side-tabs')).toBeHidden()

  const buyQuickActions = dialog.getByLabel('매수 수량 빠른 입력')
  await expect(buyQuickActions.getByRole('button')).toHaveCount(5)
  expect(await buyQuickActions.getByRole('button').allTextContents()).toEqual(['+1주', '+10주', '+100주', '최대', '←'])
  await expect(buyQuickActions.getByRole('button', { name: '한 자리 지우기' })).toHaveText('←')
  const startMarket = dialog.getByRole('button', { name: '장 시작하고 시가 확인' })
  await expect(startMarket).toBeVisible()
  await expect(dialog.locator('.trade-submit.buy')).toBeInViewport()
  await expect(dialog.locator('.settled-cash strong')).toContainText('원')
  await expect(dialog.locator('.settled-cash strong')).not.toContainText('₩')
  await expectDialogFits(dialog)

  expect(await fontSizePx(dialog.locator('.trading-panel-heading h3'))).toBeGreaterThanOrEqual(16)
  expect(await fontSizePx(dialog.locator('.settled-cash span'))).toBeGreaterThanOrEqual(11)
  expect(await fontSizePx(dialog.locator('.settled-cash strong'))).toBeGreaterThanOrEqual(14)
  expect(await fontSizePx(dialog.locator('.buy-mode-tabs button').first())).toBeGreaterThanOrEqual(12.5)
  expect(await fontSizePx(dialog.locator('.order-form label > span').first())).toBeGreaterThanOrEqual(12)
  expect(await fontSizePx(dialog.locator('.order-form input').first())).toBeGreaterThanOrEqual(15.5)
  expect(await fontSizePx(buyQuickActions.getByRole('button').first())).toBeGreaterThanOrEqual(12)
  expect(await fontSizePx(dialog.locator('.order-preview span').first())).toBeGreaterThanOrEqual(10.5)
  expect(await fontSizePx(dialog.locator('.order-preview strong').first())).toBeGreaterThanOrEqual(11.5)
  expect(await fontSizePx(dialog.locator('.trade-submit.buy'))).toBeGreaterThanOrEqual(13)

  await startMarket.click()
  await expect(dialog.getByText('오늘 체결 시가')).toBeVisible()
  expect(await fontSizePx(dialog.locator('.open-price-strip span').first())).toBeGreaterThanOrEqual(10.5)
  expect(await fontSizePx(dialog.locator('.open-price-strip strong').first())).toBeGreaterThanOrEqual(14)
  await expectDialogFits(dialog)

  const layout = await dialog.evaluate((element) => ({
    quickActionTops: Array.from(element.querySelectorAll('.buy-quick-actions button')).map((button) => button.getBoundingClientRect().top),
    quickActionWidths: Array.from(element.querySelectorAll('.buy-quick-actions button')).map((button) => button.getBoundingClientRect().width),
    quickActionClipped: Array.from(element.querySelectorAll('.buy-quick-actions button')).some((button) => button.scrollWidth > button.clientWidth + 1),
    previewTops: Array.from(element.querySelectorAll('.order-preview > div')).map((item) => item.getBoundingClientRect().top),
  }))

  expect(verticalSpread(layout.quickActionTops)).toBeLessThanOrEqual(1)
  expect(verticalSpread(layout.quickActionWidths)).toBeLessThanOrEqual(1)
  expect(layout.quickActionClipped).toBe(false)

  const documentWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(documentWidth.scrollWidth).toBeLessThanOrEqual(documentWidth.clientWidth + 1)

  if (testInfo.project.name.startsWith('mobile-') && (testInfo.project.use.viewport?.width ?? 0) >= 360) {
    expect(verticalSpread(layout.previewTops)).toBeLessThanOrEqual(1)
  }

  const backdropStyle = await page.locator('.trading-dialog-backdrop').evaluate((element) => {
    const style = getComputedStyle(element)
    return { backdropFilter: style.backdropFilter, backgroundColor: style.backgroundColor }
  })
  expect(backdropStyle.backdropFilter).toBe('blur(2px)')
  expect(backdropStyle.backgroundColor).toBe('rgba(4, 5, 8, 0.4)')

  await dialog.getByRole('button', { name: '주문 유형 선택으로 돌아가기' }).click()
  await expect(sideSelector).toBeVisible()
  await sellAction.click()
  await expect(dialog.locator('.trade-side-tabs')).toBeHidden()

  const sellQuickActions = dialog.getByLabel('매도 수량 빠른 입력')
  await expect(sellQuickActions.getByRole('button')).toHaveCount(4)
  expect(await sellQuickActions.getByRole('button').allTextContents()).toEqual(['25%', '50%', '전량', '←'])
  await expect(sellQuickActions.getByRole('button', { name: '한 자리 지우기' })).toHaveText('←')
  await expect(dialog.locator('.trade-submit.sell')).toBeInViewport()
  await expectDialogFits(dialog)

  const sellLayout = await sellQuickActions.evaluate((element) => ({
    tops: Array.from(element.querySelectorAll('button')).map((button) => button.getBoundingClientRect().top),
    widths: Array.from(element.querySelectorAll('button')).map((button) => button.getBoundingClientRect().width),
    clipped: Array.from(element.querySelectorAll('button')).some((button) => button.scrollWidth > button.clientWidth + 1),
  }))
  expect(verticalSpread(sellLayout.tops)).toBeLessThanOrEqual(1)
  expect(verticalSpread(sellLayout.widths)).toBeLessThanOrEqual(1)
  expect(sellLayout.clipped).toBe(false)

  await dialog.getByRole('button', { name: '주문 거래 닫기' }).click()
  await page.getByRole('button', { name: '장 마감' }).click()
  await expect(page.getByText(/오늘 종가로 매수·매도할 수 있습니다/)).toBeVisible()

  await page.locator('.asset-list-row').first().click()
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('주문 유형 선택').getByRole('button', { name: '매수', exact: true }).click()
  await expect(dialog.getByText('오늘 체결 종가')).toBeVisible()
  await dialog.getByLabel('매수 수량 빠른 입력').getByRole('button', { name: '+1주' }).click()
  await expect(dialog.locator('.trade-submit.buy')).toContainText('종가 매수')
  await dialog.locator('.trade-submit.buy').click()
  await expect(dialog.getByText(/오늘 종가로 1주 매수 체결했습니다/)).toBeVisible()
  await expectDialogFits(dialog)
})
