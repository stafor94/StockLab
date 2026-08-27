import { expect, test } from '@playwright/test'

const calendarFixture = (market: 'KR' | 'US') => ({
  schemaVersion: 1,
  market,
  timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
  coverage: { from: '2018-01-01', to: '2018-02-28' },
  tradingDates: ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05'],
  closures: market === 'KR'
    ? []
    : [{ date: '2018-01-01', reason: "New Year's Day" }, { date: '2018-01-15', reason: 'Martin Luther King Jr. Day' }],
  source: { authoritativeProvider: 'E2E fixture', mode: 'generated', generatedAt: null },
})

const krClosureFixture = {
  schemaVersion: 1,
  market: 'KR',
  coverage: { from: '2018-01-01', to: '2018-02-28' },
  closures: [
    { date: '2018-01-01', reason: '신정' },
    { date: '2018-02-17', reason: '설날 연휴' },
  ],
  source: {
    authoritativeProvider: 'KRX Market Closing(Holiday)',
    referenceUrl: 'https://global.krx.co.kr/',
    verifiedAt: '2026-08-27',
  },
}

test.beforeEach(async ({ page }) => {
  await page.route('**/data/calendars/*.json', async (route) => {
    const url = route.request().url()
    if (url.endsWith('/kr-closures.json')) {
      await route.fulfill({ json: krClosureFixture })
      return
    }
    const market = url.endsWith('/kr.json') ? 'KR' : 'US'
    await route.fulfill({ json: calendarFixture(market) })
  })
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
    version: 12,
  })))
})

test('current date opens a market calendar with KR and US closures', async ({ page }) => {
  await page.goto('./')
  const dateButton = page.getByRole('button', { name: /현재 날짜.*시장 캘린더 열기/ })
  await expect(dateButton).toContainText('2018. 01. 01. (월)')
  await dateButton.click()

  const calendar = page.getByRole('dialog', { name: '2018년 1월' })
  await expect(calendar).toBeVisible()
  await expect(calendar.getByRole('button', { name: /2018-01-01.*KRX 휴장.*미국 휴장.*현재 날짜/ })).toBeVisible()
  await expect(calendar.getByText('한 KRX 휴장')).toBeVisible()
  await expect(calendar.getByText('미 미국 휴장')).toBeVisible()
  await expect(calendar.getByText('KRX · 신정')).toBeVisible()
  await expect(calendar.getByText("미국 · New Year's Day")).toBeVisible()

  await calendar.getByRole('button', { name: /2018-01-08.*KRX 휴장.*미국 휴장/ }).click()
  await expect(calendar.getByText('KRX · 공휴일 또는 거래소 지정 휴장일')).toBeVisible()
  await expect(calendar.getByText('미국 · 공휴일 또는 거래소 지정 휴장일')).toBeVisible()

  await calendar.getByRole('button', { name: /2018-01-15.*미국 휴장/ }).click()
  await expect(calendar.getByText('미국 · Martin Luther King Jr. Day')).toBeVisible()
  await expect(calendar.getByText('KRX · 신정')).toHaveCount(0)

  await calendar.getByRole('button', { name: '다음 달' }).click()
  const februaryCalendar = page.getByRole('dialog', { name: '2018년 2월' })
  const weekendHoliday = februaryCalendar.getByRole('button', { name: /2018-02-17.*주말.*KRX 휴장/ })
  await expect(weekendHoliday).toBeVisible()
  await weekendHoliday.click()
  await expect(februaryCalendar.getByText('KRX · 설날 연휴')).toBeVisible()
  await expect(februaryCalendar.getByText('주말 · 정규장 없음')).toBeVisible()

  await februaryCalendar.getByRole('button', { name: '시장 캘린더 닫기' }).click()
  await expect(februaryCalendar).toHaveCount(0)
})

test('market calendar stays inside compact viewports without page overflow', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: /현재 날짜.*시장 캘린더 열기/ }).click()
  const calendar = page.getByRole('dialog', { name: '2018년 1월' })
  await expect(calendar).toBeVisible()
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
  const box = await calendar.boundingBox()
  const viewport = page.viewportSize()
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)
})
