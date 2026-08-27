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

test('shared header stays fixed while scrolling and navigating all primary tabs', async ({ page }) => {
  await page.goto('./')
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
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  const headerTop = await header.evaluate((element) => element.getBoundingClientRect().top)
  expect(Math.abs(headerTop)).toBeLessThanOrEqual(1)
  await expect(header.getByRole('heading', { name: 'StockLab' })).toBeVisible()
})

test('favorites can be filtered and survive a reload', async ({ page }) => {
  await page.goto('./')
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
