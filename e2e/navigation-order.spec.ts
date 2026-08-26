import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
    version: 10,
  })))
})

function usesCompactTouchLayout(projectName: string) {
  return projectName.startsWith('mobile-') || projectName.startsWith('tablet-')
}

async function advanceToFirstTradingDate(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '게임 진행 열기' }).tap()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '다음 날' }).tap()
  await expect(page.getByLabel('현재 날짜')).toContainText('2018-01-02')
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).tap()
}

test('touch navigation releases stale focus while changing screens', async ({ page }, testInfo) => {
  test.skip(!usesCompactTouchLayout(testInfo.project.name), 'Pointer-focus regression is specific to touch navigation layouts.')
  await page.goto('./')

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  const home = navigation.getByRole('button', { name: '홈' })
  const market = navigation.getByRole('button', { name: /시장/ })

  await home.focus()
  await expect(home).toBeFocused()
  await market.tap()

  await expect(home).not.toBeFocused()
  await expect(market).not.toBeFocused()
  await expect(market).toHaveAttribute('aria-current', 'page')
})

test('compact market flow opens first, previews 100-share cost, then trades at the open', async ({ page }, testInfo) => {
  test.skip(!usesCompactTouchLayout(testInfo.project.name), 'Compact market auto-scroll is used below the desktop split layout.')
  await page.goto('./')
  await advanceToFirstTradingDate(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).tap()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()

  const firstAsset = page.locator('.asset-list-row').first()
  await expect(firstAsset).toBeVisible()
  await firstAsset.tap()

  const detail = page.locator('.asset-detail')
  const ticket = detail.getByRole('heading', { name: 'WS증권 시가 주문' })
  await expect(detail).toBeInViewport()
  await expect(ticket).toBeInViewport()

  const startButton = detail.getByRole('button', { name: '장 시작하고 시가 확인' })
  await expect(startButton).toBeVisible()
  await startButton.tap()
  await expect(detail.getByText('오늘 체결 시가')).toBeVisible()
  await expect(startButton).toHaveCount(0)

  const quantityInput = detail.getByRole('spinbutton', { name: '매수 수량' })
  await quantityInput.fill('100')
  const total = detail.locator('.order-preview-total strong')
  await expect(total).not.toHaveText('—')
  await expect(total).toContainText(/₩|\$/)

  await quantityInput.fill('1')
  const buyButton = detail.getByRole('button', { name: /1주 시가 매수/ })
  await expect(buyButton).toBeEnabled()
  await buyButton.tap()
  await expect(detail.locator('.trade-message')).toContainText('1주 매수 체결')
  await expect(detail.getByText('1주', { exact: true })).toBeVisible()
})
