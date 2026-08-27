import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: { guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true } },
    version: 10,
  })))
})

test('uses the deployed BOK rate for bidirectional exchange at game start', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '자산' }).click()

  await expect(page.getByText('2017-12-29 공표값 기준')).toBeVisible()
  await expect(page.getByText('환율 데이터 준비 중')).toHaveCount(0)

  const amount = page.getByLabel('환전 금액')
  const submit = page.getByRole('button', { name: '환전 실행' })
  const historyRows = page.locator('.exchange-history-list > div')

  await amount.fill('100000')
  await submit.click()
  await expect(page.getByText('환전이 완료되었습니다.')).toBeVisible()
  await expect(historyRows).toHaveCount(1)

  await page.getByRole('button', { name: '달러 → 원화' }).click()
  await amount.fill('10')
  await submit.click()
  await expect(page.getByText('환전이 완료되었습니다.')).toBeVisible()
  await expect(historyRows).toHaveCount(2)
})

test('keeps exchange available and applies preference only during the Korean session', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '자산' }).click()

  const policy = page.locator('.exchange-policy')
  const amount = page.getByLabel('환전 금액')
  const submit = page.getByRole('button', { name: '환전 실행' })

  await expect(policy.getByText('미적용')).toBeVisible()
  await expect(policy.getByText('항상')).toBeVisible()
  await amount.fill('100000')
  await expect(submit).toBeEnabled()

  await page.getByRole('button', { name: '홈' }).click()
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '국내장 시작' }).click()
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()

  await page.getByRole('button', { name: '자산' }).click()
  await expect(page.locator('.exchange-policy').getByText('95% 적용')).toBeVisible()
  await page.getByLabel('환전 금액').fill('100000')
  const openMarketSubmit = page.getByRole('button', { name: '환전 실행' })
  await expect(openMarketSubmit).toBeEnabled()
  await openMarketSubmit.click()
  await expect(page.getByText('환전이 완료되었습니다.')).toBeVisible()
})
