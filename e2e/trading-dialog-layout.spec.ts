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

test('mobile trading dialog fits the pre-open order form without internal scrolling', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'This regression targets the compact phone order dialog.')

  await page.goto('./')
  await advanceToFirstTradingDate(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).click()
  await page.locator('.asset-list-row').first().click()

  const dialog = page.getByRole('dialog', { name: /주문 거래/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '장 시작하고 시가 확인' })).toBeVisible()
  await expect(dialog.locator('.trade-submit.buy')).toBeInViewport()
  await expect(dialog.locator('.settled-cash strong')).toContainText('원')
  await expect(dialog.locator('.settled-cash strong')).not.toContainText('₩')

  const layout = await dialog.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    dialogWidth: element.getBoundingClientRect().width,
    titleWidth: element.querySelector('.trading-dialog-header h2')?.getBoundingClientRect().width ?? 0,
    titleClientWidth: element.querySelector('.trading-dialog-header h2')?.clientWidth ?? 0,
    titleScrollWidth: element.querySelector('.trading-dialog-header h2')?.scrollWidth ?? 0,
    quickActionTops: Array.from(element.querySelectorAll('.quantity-quick-actions button')).map((button) => button.getBoundingClientRect().top),
    previewTops: Array.from(element.querySelectorAll('.order-preview > div')).map((item) => item.getBoundingClientRect().top),
  }))

  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1)
  expect(layout.titleWidth).toBeGreaterThanOrEqual(layout.dialogWidth * 0.7)
  expect(layout.titleScrollWidth).toBeLessThanOrEqual(layout.titleClientWidth + 1)
  expect(verticalSpread(layout.quickActionTops)).toBeLessThanOrEqual(1)

  if ((testInfo.project.use.viewport?.width ?? 0) >= 360) {
    expect(verticalSpread(layout.previewTops)).toBeLessThanOrEqual(1)
  }

  const backdropStyle = await page.locator('.trading-dialog-backdrop').evaluate((element) => {
    const style = getComputedStyle(element)
    return { backdropFilter: style.backdropFilter, backgroundColor: style.backgroundColor }
  })
  expect(backdropStyle.backdropFilter).toBe('blur(2px)')
  expect(backdropStyle.backgroundColor).toBe('rgba(4, 5, 8, 0.4)')
})
