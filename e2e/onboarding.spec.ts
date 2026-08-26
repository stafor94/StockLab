import { expect, test, type Locator, type Page } from '@playwright/test'

async function emptySave(page: Page) {
  await page.addInitScript(() => { localStorage.removeItem('stocklab.save'); localStorage.removeItem('stocklab.qa-events') })
}

async function noOverflow(page: Page, locator?: Locator) {
  const values = await (locator ?? page.locator('html')).evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
  expect(values.scrollWidth).toBeLessThanOrEqual(values.clientWidth + 1)
}

test('새 사용자가 주문부터 다음 게임일과 새로고침까지 완료한다', async ({ page }) => {
  await emptySave(page)
  await page.goto('./')
  const tutorial = page.getByRole('dialog', { name: 'StockLab 튜토리얼' })
  await expect(tutorial).toBeVisible()
  await tutorial.getByRole('button', { name: '튜토리얼 시작' }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()
  await expect(page.locator('.asset-detail').getByRole('heading').first()).toBeVisible()

  // 시작일은 공동 휴일이므로 다음 거래일로 먼저 이동한다.
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '홈' }).click()
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  await page.getByRole('dialog', { name: '시간 진행' }).getByRole('button', { name: '다음 날' }).click()
  await expect(page.getByLabel('게임 날짜')).toContainText('2018-01-02')
  await page.getByRole('button', { name: '게임 진행 닫기' }).click()
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '시장' }).click()
  const order = page.locator('.trading-panel')
  await order.getByPlaceholder('예: 1000000').fill('100000')
  await order.getByRole('button', { name: '오늘 시가 매수 주문' }).click()
  await expect(order.getByText(/개장 전 시장가 주문을 접수/)).toBeVisible()
  await page.getByRole('button', { name: '장 시작' }).click()
  await expect(page.getByText(/시가 체결 1건/)).toBeVisible()
  await page.getByRole('button', { name: '장 마감' }).click()
  await expect(page.getByText(/오늘 장을 마감/)).toBeVisible()
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '홈' }).click()
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  await page.getByRole('dialog', { name: '시간 진행' }).getByRole('button', { name: '다음 날' }).click()
  await page.getByRole('button', { name: '게임 진행 닫기' }).click()
  await page.getByRole('button', { name: '튜토리얼 완료' }).click()
  const savedDate = await page.getByLabel('게임 날짜').textContent()
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'StockLab 튜토리얼' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '튜토리얼 완료' })).toHaveCount(0)
  await expect(page.getByLabel('게임 날짜')).toHaveText(savedDate ?? '')
  await expect(page.getByText('₩100,000').first()).toBeVisible()
})

test('주문하지 않아도 첫 거래일을 진행할 수 있다', async ({ page }) => {
  await emptySave(page); await page.goto('./')
  await page.getByRole('dialog', { name: 'StockLab 튜토리얼' }).getByRole('button', { name: '건너뛰기' }).click()
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const sheet = page.getByRole('dialog', { name: '시간 진행' })
  await sheet.getByRole('button', { name: '다음 날' }).click()
  await sheet.getByRole('button', { name: '장 시작' }).click()
  await expect(sheet.getByText(/당일 시가가 공개/)).toBeVisible()
  await sheet.getByRole('button', { name: '장 마감' }).click()
  await expect(sheet.getByText(/당일 OHLC가 공개/)).toBeVisible()
})

test('안내 UI가 반응형·키보드·reduced motion 요구를 지킨다', async ({ page }) => {
  await emptySave(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  const tutorial = page.getByRole('dialog', { name: 'StockLab 튜토리얼' })
  await noOverflow(page); await noOverflow(page, tutorial)
  const buttons = tutorial.getByRole('button')
  for (let i = 0; i < await buttons.count(); i += 1) expect((await buttons.nth(i).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await page.keyboard.press('Tab'); await expect(page.locator(':focus')).toBeVisible()
  await tutorial.getByRole('button', { name: '건너뛰기' }).focus(); await page.keyboard.press('Enter')
  const card = page.getByLabel('다음 행동 안내'); await expect(card).toBeVisible(); await noOverflow(page, card)
  await card.getByRole('button', { name: '도움말' }).focus(); await page.keyboard.press('Enter')
  const help = page.getByRole('dialog', { name: '도움말' }); await expect(help).toBeVisible(); await noOverflow(page, help)
  await help.getByRole('button', { name: '도움말 닫기' }).click()
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  await noOverflow(page, page.getByRole('dialog', { name: '시간 진행' }))
  expect(await card.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s')
})
