import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('stocklab.save')) return
    localStorage.setItem('stocklab.save', JSON.stringify({
      state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
      version: 12,
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

test('shared header stays fixed while scrolling and navigating all primary tabs', async ({ page }) => {
  await page.goto('./')
  await openFirstKrxSession(page)

  const header = page.locator('.app-header')
  const navigation = page.getByRole('navigation', { name: '주 메뉴' })

  await expect(header).toBeVisible()
  expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('sticky')
  expect(await header.evaluate((element) => getComputedStyle(element).top)).toBe('0px')

  for (const tab of ['시장', '포트폴리오', '뉴스', '자산', '홈']) {
    await navigation.getByText(tab, { exact: true }).click()
    await expect(header).toBeVisible()
    expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('sticky')
  }

  await navigation.getByText('시장', { exact: true }).click()
  const assetList = page.locator('.asset-list-scroll')
  await expect(assetList.locator('.asset-list-row').first()).toBeVisible()
  await assetList.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => assetList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  const headerTop = await header.evaluate((element) => element.getBoundingClientRect().top)
  expect(Math.abs(headerTop)).toBeLessThanOrEqual(1)
  await expect(header.getByRole('heading', { name: 'StockLab' })).toBeVisible()
})

test('favorites can be filtered and survive a reload', async ({ page }) => {
  await page.goto('./')
  await openFirstKrxSession(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByText('시장', { exact: true }).click()

  const rows = page.locator('.asset-list-row')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeGreaterThan(1)

  const firstRow = rows.first()
  const alias = await firstRow.locator('.asset-list-copy strong').innerText()
  const favoriteButton = firstRow.getByRole('button', { name: /즐겨찾기 추가$/ })
  await favoriteButton.click()
  await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true')

  const favoritesOnly = page.getByRole('button', { name: '즐겨찾기만 보기' })
  await favoritesOnly.click()
  await expect(favoritesOnly).toHaveAttribute('aria-pressed', 'true')
  await expect(rows).toHaveCount(1)
  await expect(rows.first().locator('.asset-list-copy strong')).toHaveText(alias)

  await page.reload()
  await navigation.getByText('시장', { exact: true }).click()
  const reloadedFavoritesOnly = page.getByRole('button', { name: '즐겨찾기만 보기' })
  await reloadedFavoritesOnly.click()
  await expect(page.locator('.asset-list-row')).toHaveCount(1)
  await expect(page.locator('.asset-list-row').first().locator('.asset-list-copy strong')).toHaveText(alias)
  await expect(page.locator('.asset-list-row').first().getByRole('button', { name: /즐겨찾기 해제$/ })).toHaveAttribute('aria-pressed', 'true')
})