import { expect, test } from '@playwright/test'

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
  await expect(page.getByText('v0.20.10')).toBeVisible()
  await expect(page.getByLabel('현재 날짜')).toContainText('2018-01-01')
  await expect(page.getByText('게임 날짜')).toHaveCount(0)
  await expect(page.getByText('10,000,000원').first()).toBeVisible()
  expect(await page.locator('.app-screen').innerText()).not.toContain('₩')
  await expect(page.getByText('내 투자')).toBeVisible()
  await expect(page.getByLabel('순자산')).toBeVisible()
  await expect(page.getByLabel('현금')).toBeVisible()
  await expect(page.getByText('원화')).toBeVisible()
  await expect(page.getByText('달러')).toBeVisible()
  await expect(page.getByRole('heading', { name: '오늘의 시장' })).toBeVisible()
  await expect(page.getByRole('button', { name: '도움말' })).toBeVisible()
  await expect(page.getByRole('button', { name: '설정' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  await expect(nav.getByRole('button')).toHaveCount(5)
  await expect(nav.getByRole('button', { name: '홈' })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('button', { name: /시장 보기/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expect(nav.getByRole('button', { name: /시장/ })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  await page.getByRole('button', { name: /전체보기/ }).click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await expect(nav.getByRole('button', { name: /뉴스/ })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: '홈' }).click()
  await expect(page.getByRole('dialog', { name: '시간 진행' })).toHaveCount(0)
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await expect(progressDialog).toBeVisible()

  const nextDay = progressDialog.getByRole('button', { name: '다음 날' })
  await expect(nextDay).toBeEnabled()
  await nextDay.click()
  await expect(page.getByLabel('현재 날짜')).toContainText('2018-01-02')

  const openMarket = progressDialog.getByRole('button', { name: '장 시작' })
  await expect(openMarket).toBeEnabled()
  await openMarket.click()
  await expect(progressDialog.getByText(/시장 탭에서 공개된 실제 시가로 매수·매도/)).toBeVisible()
  const closeMarket = progressDialog.getByRole('button', { name: '장 마감' })
  await expect(closeMarket).toBeEnabled()
  await closeMarket.click()
  await expect(progressDialog.getByText(/장이 마감되었습니다/)).toBeVisible()
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()

  await nav.getByRole('button', { name: /시장/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await nav.getByRole('button', { name: /포트폴리오/ }).click()
  await expect(page.getByRole('heading', { name: '포트폴리오' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await nav.getByRole('button', { name: /뉴스/ }).click()
  await expect(page.getByRole('heading', { name: '뉴스' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await nav.getByRole('button', { name: /기록/ }).click()
  await expect(page.getByRole('heading', { name: '기록' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
