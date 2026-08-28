import { expect, test } from '@playwright/test'

const loanHistory = [
  { id: 'L000001', date: '2019-01-02', type: 'interest_paid', amount: 12000, note: '1월 이자 자동 납부' },
  { id: 'L000002', date: '2019-02-01', type: 'interest_paid', amount: 12100, note: '2월 이자 자동 납부' },
  { id: 'L000003', date: '2019-03-04', type: 'interest_paid', amount: 12200, note: '3월 이자 자동 납부' },
  { id: 'L000004', date: '2019-04-01', type: 'principal_repayment', amount: 1000000, note: '원금 100만원 중도상환' },
  { id: 'L000005', date: '2019-05-02', type: 'interest_paid', amount: 11000, note: '5월 이자 자동 납부' },
  { id: 'L000006', date: '2019-06-03', type: 'payment_failed', amount: 11100, note: '원화 현금 부족으로 자동출금 실패' },
  { id: 'L000007', date: '2019-07-01', type: 'interest_due', amount: 11200, note: '7월 이자 청구' },
  { id: 'L000008', date: '2019-07-01', type: 'interest_paid', amount: 11200, note: '7월 이자 자동 납부' },
  { id: 'L000009', date: '2019-08-01', type: 'interest_due', amount: 11300, note: '8월 이자 청구' },
  { id: 'L000010', date: '2019-08-01', type: 'interest_paid', amount: 11300, note: '8월 이자 자동 납부' },
] as const

test.beforeEach(async ({ page }) => {
  await page.addInitScript((history) => localStorage.setItem('stocklab.save', JSON.stringify({
    state: {
      gameDate: '2019-08-05',
      gameTimestamp: '2019-08-05T00:00:00.000Z',
      gameDisplayTimestamp: '2019-08-05T00:00:00.000Z',
      krwCash: 185322,
      usdCash: 0,
      loan: {
        principal: 10000000,
        status: 'current',
        originationDate: '2018-01-01',
        lastProcessedDate: '2019-08-05',
        accruedInterest: 0,
        pastDueInterest: 0,
        overdueCharge: 0,
        pastDueSince: null,
        consecutiveMissedMonths: 0,
        history,
        nextEventNumber: 11,
      },
      marketSessions: {
        KR: { phase: 'preopen', tradingDate: '2019-08-05' },
        US: { phase: 'preopen', tradingDate: '2019-08-05' },
      },
      guidance: {
        tutorialStatus: 'skipped',
        experienced: [],
        checklistCollapsed: true,
        skipOrderConfirmationShown: true,
        seenLoanPaymentFailures: 1,
      },
    },
    version: 13,
  })), loanHistory)
})

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1)
}

test('compacts asset balances and pages meaningful loan history', async ({ page }) => {
  await page.goto('./')

  const homeLoan = page.locator('.investment-loan-compact')
  await expect(homeLoan).toBeVisible()
  await expect(homeLoan.locator('small')).toHaveCount(0)

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  await nav.getByRole('button', { name: '자산' }).click()
  await expect(page.getByRole('heading', { name: '자산' })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const groups = page.locator('.asset-account-group')
  await expect(groups).toHaveCount(3)
  const boxes = await Promise.all([0, 1, 2].map((index) => groups.nth(index).boundingBox()))
  const firstY = boxes[0]?.y ?? 0
  for (const box of boxes.slice(1)) expect(Math.abs((box?.y ?? 0) - firstY)).toBeLessThanOrEqual(1)
  expect(boxes[1]?.x ?? 0).toBeGreaterThan((boxes[0]?.x ?? 0) + (boxes[0]?.width ?? 0) - 1)
  expect(boxes[2]?.x ?? 0).toBeGreaterThan((boxes[1]?.x ?? 0) + (boxes[1]?.width ?? 0) - 1)

  await page.getByRole('button', { name: 'WS은행 대출' }).click()
  await expect(page.getByRole('heading', { name: 'WS은행 대출' })).toBeVisible()

  const historyRows = page.locator('.loan-history-list > div')
  await expect(historyRows).toHaveCount(5)
  await expect(page.getByText('이자 청구', { exact: false })).toHaveCount(0)

  const more = page.getByRole('button', { name: '더보기' })
  await expect(more).toBeVisible()
  const moreBox = await more.boundingBox()
  expect(moreBox?.height ?? 0).toBeGreaterThanOrEqual(44)
  await more.click()

  await expect(historyRows).toHaveCount(8)
  await expect(page.getByRole('button', { name: '더보기' })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})
