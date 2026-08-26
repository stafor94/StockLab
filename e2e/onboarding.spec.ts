import { expect, test } from '@playwright/test'

async function clearSave(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const marker = '__stocklab_e2e_save_cleared'
    if (sessionStorage.getItem(marker)) return
    localStorage.removeItem('stocklab.save')
    localStorage.removeItem('stocklab.qa-events')
    sessionStorage.setItem(marker, '1')
  })
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

test('first-run tutorial is optional, keyboard accessible, and persists completion', async ({ page }) => {
  await clearSave(page)
  await page.goto('./')
  const tutorial = page.locator('.tutorial-dialog')
  await expect(tutorial).toBeVisible()
  await expect(tutorial.getByRole('heading', { name: '미래를 모른 채 투자해 보세요' })).toBeVisible()
  await expect(tutorial.getByRole('button', { name: '3분 둘러보기' })).toBeFocused()
  await expectNoHorizontalOverflow(page)

  await tutorial.getByRole('button', { name: '3분 둘러보기' }).click()
  await expect(tutorial).toContainText('과거 차트와 현재 게임 날짜까지 공개된 정보')
  for (let step = 0; step < 3; step += 1) await tutorial.getByRole('button', { name: '다음' }).click()
  await tutorial.getByRole('button', { name: '시작하기' }).click()
  await expect(tutorial).toHaveCount(0)

  await page.reload()
  await expect(page.locator('.tutorial-dialog')).toHaveCount(0)
})

test('first no-order session start asks once and then proceeds normally', async ({ page }) => {
  await clearSave(page)
  await page.goto('./')
  await page.locator('.tutorial-dialog').getByRole('button', { name: '건너뛰기' }).click()
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progress = page.getByRole('dialog', { name: '시간 진행' })
  await progress.getByRole('button', { name: '다음 날' }).click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')

  page.once('dialog', (dialog) => void dialog.accept())
  await progress.getByRole('button', { name: '장 시작' }).click()
  await expect(progress.getByText(/당일 시가가 공개되었습니다/)).toBeVisible()
  await progress.getByRole('button', { name: '장 마감' }).click()
  await expect(progress.getByText(/당일 OHLC가 공개/)).toBeVisible()
})

test('guidance and help respect reduced motion and mobile overflow', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: false, skipOrderConfirmationShown: false } },
    version: 10,
  })))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await expectNoHorizontalOverflow(page)
  const card = page.locator('.home-next-action')
  await expect(card).toBeVisible()
  expect(await card.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s')

  await page.getByRole('button', { name: '도움말' }).click()
  const help = page.getByRole('dialog', { name: '도움말' })
  await expect(help).toBeVisible()
  await expect(help.getByRole('button', { name: '도움말 닫기' })).toBeFocused()
  await help.press('Escape')
  await expect(help).toHaveCount(0)
})
