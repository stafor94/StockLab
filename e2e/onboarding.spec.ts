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
  await expect(tutorial).toContainText('국내장과 미국장은 서로 다른 거래일·거래시간과 휴장일')
  for (let step = 0; step < 3; step += 1) await tutorial.getByRole('button', { name: '다음' }).click()
  await tutorial.getByRole('button', { name: '시작하기' }).click()
  await expect(tutorial).toHaveCount(0)

  await page.reload()
  await expect(page.locator('.tutorial-dialog')).toHaveCount(0)
})

test('first KRX session opens without an obsolete preopen-order confirmation', async ({ page }) => {
  await clearSave(page)
  await page.goto('./')
  await page.locator('.tutorial-dialog').getByRole('button', { name: '건너뛰기' }).click()
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progress = page.getByRole('dialog', { name: '시간 진행' })

  let browserDialogShown = false
  page.once('dialog', async (dialog) => {
    browserDialogShown = true
    await dialog.dismiss()
  })
  await progress.getByRole('button', { name: '국내장 시작' }).click()
  await expect(page.getByLabel(/현재 날짜/)).toContainText('2018. 01. 02. (화)')
  await expect(page.getByLabel(/현재 날짜/)).toContainText('09:00')
  await expect(progress.getByText(/국내장 시작/)).toBeVisible()
  expect(browserDialogShown).toBe(false)

  await progress.getByRole('button', { name: '국내장 마감' }).click()
  await expect(page.getByLabel(/현재 날짜/)).toContainText('15:29')
  await expect(progress.getByText(/국내장 마감/)).toBeVisible()
})

test('guidance and help respect reduced motion and mobile overflow', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: false, skipOrderConfirmationShown: false } },
    version: 10,
  })))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await expectNoHorizontalOverflow(page)
  await expect(page.getByText('첫 게임 추천')).toHaveCount(0)
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
