import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('stocklab.save')) return
    localStorage.setItem('stocklab.save', JSON.stringify({
      state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
      version: 10,
    }))
  })
})

function usesCompactTouchLayout(projectName: string) {
  return projectName.startsWith('mobile-') || projectName.startsWith('tablet-')
}

async function advanceToFirstTradingDate(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '다음 날' }).click()
  await expect(page.getByLabel('현재 날짜')).toContainText('2018-01-02')
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()
}

test('touch navigation never paints a stale focus outline while changing screens', async ({ page }, testInfo) => {
  test.skip(!usesCompactTouchLayout(testInfo.project.name), 'Pointer-focus regression is specific to touch navigation layouts.')
  await page.goto('./')

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  const home = navigation.getByRole('button', { name: '홈' })
  const portfolio = navigation.getByRole('button', { name: '포트폴리오' })

  await home.focus()
  await expect(home).toBeFocused()
  await portfolio.tap()

  await expect(portfolio).toHaveAttribute('aria-current', 'page')
  await expect(navigation).toHaveAttribute('data-keyboard-focus', 'false')

  // Some Android browsers can retain or restore focus on the previous button after a touch navigation.
  // Pointer modality must still suppress the visual outline even in that stubborn-focus state.
  await home.focus()
  const staleOutline = await home.evaluate((element) => getComputedStyle(element).outlineStyle)
  expect(staleOutline).toBe('none')
})

test('recommended home tab never paints a rectangular border on touch navigation', async ({ page }, testInfo) => {
  test.skip(!usesCompactTouchLayout(testInfo.project.name), 'The reported regression is specific to compact touch navigation.')
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: {
      guidance: {
        tutorialStatus: 'skipped',
        experienced: ['market-visited'],
        checklistCollapsed: true,
        skipOrderConfirmationShown: true,
      },
    },
    version: 10,
  })))
  await page.reload()

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  const home = navigation.getByRole('button', { name: '홈' })
  const market = navigation.getByRole('button', { name: /시장/ })
  await expect(home).toHaveClass(/guidance-recommended/)

  await market.tap()
  await expect(market).toHaveAttribute('aria-current', 'page')
  await expect(home).not.toHaveAttribute('aria-current', 'page')

  const decoration = await home.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      boxShadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
    }
  })
  expect(decoration).toEqual({
    boxShadow: 'none',
    outlineStyle: 'none',
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
  })
})

test('opening assets clears the seen loan-payment badge without changing the loan state', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: {
      guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true },
      loan: {
        status: 'overdue',
        consecutiveMissedMonths: 1,
        history: [{ id: 'L000001', date: '2018-02-01', type: 'payment_failed', amount: 0, note: '이자 결제 실패' }],
        nextEventNumber: 2,
      },
    },
    version: 10,
  })))
  await page.reload()

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  const assets = navigation.getByRole('button', { name: /자산/ })
  await expect(assets.locator('.navigation-attention')).toHaveText('1')

  await assets.click()

  await expect(assets).toHaveAttribute('aria-current', 'page')
  await expect(assets.locator('.navigation-attention')).toHaveCount(0)
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('stocklab.save') ?? '{}'))
  expect(persisted.state.guidance.seenLoanPaymentFailures).toBe(1)
  expect(persisted.state.loan.status).toBe('overdue')
  expect(persisted.state.loan.consecutiveMissedMonths).toBe(1)
})

test('market and portfolio both use the shared trading dialog', async ({ page }) => {
  await page.goto('./')
  await advanceToFirstTradingDate(page)

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByRole('button', { name: /시장/ }).click()
  await expect(page.getByRole('heading', { name: '시장' })).toBeVisible()

  const firstAsset = page.locator('.asset-list-row').first()
  await expect(firstAsset).toBeVisible()
  await firstAsset.click()

  const orderDialog = page.getByRole('dialog', { name: /주문 거래/ })
  await expect(orderDialog).toBeVisible()
  await expect(orderDialog.getByRole('heading', { name: 'WS증권 시가 주문' })).toBeVisible()
  await expect(page.locator('.asset-detail .trading-panel')).toHaveCount(0)

  const startButton = orderDialog.getByRole('button', { name: '장 시작하고 시가 확인' })
  await expect(startButton).toBeVisible()
  await startButton.click()
  await expect(orderDialog.getByText('오늘 체결 시가')).toBeVisible()
  await expect(startButton).toHaveCount(0)

  const quantityInput = orderDialog.getByRole('spinbutton', { name: '매수 수량' })
  await quantityInput.fill('100')
  const total = orderDialog.locator('.order-preview-total strong')
  await expect(total).not.toHaveText('—')
  await expect(total).toContainText(/원|\$/)

  await quantityInput.fill('1')
  const buyButton = orderDialog.getByRole('button', { name: /1주 시가 매수/ })
  await expect(buyButton).toBeEnabled()
  await buyButton.click()
  await expect(orderDialog.locator('.trade-message')).toContainText('1주 매수 체결')

  await quantityInput.fill('999999999')
  const oversizedBuy = orderDialog.locator('.trade-submit.buy')
  await expect(oversizedBuy).toBeEnabled()
  await oversizedBuy.click()

  const errorDialog = page.getByRole('alertdialog', { name: '주문을 처리할 수 없습니다' })
  await expect(errorDialog).toBeVisible()
  await expect(errorDialog).toContainText(/부족|초과|주문/)
  await errorDialog.press('Escape')
  await expect(errorDialog).toHaveCount(0)
  await expect(orderDialog).toBeVisible()

  await orderDialog.getByRole('button', { name: '주문 거래 닫기' }).click()
  await expect(orderDialog).toHaveCount(0)

  await navigation.getByRole('button', { name: '포트폴리오' }).click()
  const holdingOrder = page.getByRole('button', { name: /주문 거래 열기/ }).first()
  await expect(holdingOrder).toBeVisible()
  const holdingValues = holdingOrder.locator('.holding-values')
  await expect(holdingValues.locator(':scope > *')).toHaveCount(2)
  await expect(holdingOrder.getByText('눌러서 주문')).toHaveCount(0)
  const valueTypography = await holdingValues.evaluate((element) => {
    const value = element.querySelector('strong')
    const profit = element.querySelector('span')
    return {
      value: value ? Number.parseFloat(getComputedStyle(value).fontSize) : 0,
      profit: profit ? Number.parseFloat(getComputedStyle(profit).fontSize) : 0,
    }
  })
  expect(valueTypography.value).toBeGreaterThanOrEqual(14.8)
  expect(valueTypography.profit).toBeGreaterThanOrEqual(12)
  await holdingOrder.click()

  const portfolioOrderDialog = page.getByRole('dialog', { name: /주문 거래/ })
  await expect(portfolioOrderDialog).toBeVisible()
  await expect(portfolioOrderDialog.getByRole('button', { name: '매도', exact: true })).toHaveClass(/active/)
  await expect(portfolioOrderDialog.getByText('현재 보유')).toBeVisible()
})
