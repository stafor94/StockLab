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

async function openFirstKrxSession(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '국내장 시작' }).click()
  await expect(page.getByLabel(/현재 날짜/)).toContainText('2018. 01. 02. (화)')
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()
}

test('asset chart is shown above order direction selection inside the trading dialog', async ({ page }) => {
  await page.goto('./')
  await openFirstKrxSession(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).click()
  await page.getByRole('button', { name: '한국', exact: true }).click()
  await page.locator('.asset-list-row').first().click()

  const dialog = page.getByRole('dialog', { name: /주문 거래/ })
  await expect(dialog).toBeVisible()
  await expect(page.locator('.asset-detail-slot')).toHaveCount(0)
  await expect(dialog.locator('.trading-dialog-header')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(dialog.locator('#trading-dialog-title')).toHaveCSS('color', 'rgb(23, 25, 29)')

  const chartSection = dialog.locator('.trading-dialog-chart')
  const sideSelector = dialog.getByLabel('주문 유형 선택')
  await expect(chartSection).toBeVisible()
  await expect(chartSection.getByLabel('차트 기간')).toBeVisible()
  await expect(chartSection.locator('.candlestick-chart, .chart-empty')).toBeVisible()
  await expect(sideSelector).toBeVisible()

  const chartBox = await chartSection.boundingBox()
  const selectorBox = await sideSelector.boundingBox()
  expect(chartBox).not.toBeNull()
  expect(selectorBox).not.toBeNull()
  expect((chartBox?.y ?? 0) + (chartBox?.height ?? 0)).toBeLessThanOrEqual((selectorBox?.y ?? 0) + 1)

  const dialogLayout = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dialogLayout.scrollWidth).toBeLessThanOrEqual(dialogLayout.clientWidth + 1)

  await sideSelector.getByRole('button', { name: '매수', exact: true }).click()
  await expect(chartSection).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'WS증권 시가 주문' })).toBeVisible()

  await dialog.getByRole('button', { name: '주문 유형 선택으로 돌아가기' }).click()
  await expect(dialog.locator('.trading-dialog-chart')).toBeVisible()
  await expect(dialog.getByLabel('주문 유형 선택')).toBeVisible()
})
