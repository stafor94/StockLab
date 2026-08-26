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

test('compact market flow exposes the order panel from an asset row', async ({ page }, testInfo) => {
  test.skip(!usesCompactTouchLayout(testInfo.project.name), 'Compact market auto-scroll is used below the desktop split layout.')
  await page.goto('./')

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).tap()

  const firstAsset = page.locator('.asset-list-row').first()
  await expect(firstAsset).toBeVisible()
  await expect(firstAsset).toContainText('주문')
  await firstAsset.tap()

  const detail = page.locator('.asset-detail')
  const orderShortcut = detail.getByRole('button', { name: '매수·매도 주문' })
  await expect(detail).toBeInViewport()
  await expect(orderShortcut).toBeInViewport()

  await orderShortcut.tap()
  await expect(detail.getByRole('heading', { name: 'WS증권 주문' })).toBeInViewport()
})
