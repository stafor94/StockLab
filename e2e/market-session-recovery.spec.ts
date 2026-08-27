import { expect, test } from '@playwright/test'

test('recovers a migrated U.S. preopen state before allowing the pending close', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('stocklab.save', JSON.stringify({
      state: {
        gameDate: '2018-03-13',
        gameTimestamp: '2018-03-12T15:00:00.000Z',
        gameDisplayTimestamp: '2018-03-12T15:00:00.000Z',
        marketSessions: {
          KR: { phase: 'preopen', tradingDate: null },
          US: { phase: 'preopen', tradingDate: null },
        },
        guidance: {
          tutorialStatus: 'skipped',
          experienced: [],
          checklistCollapsed: true,
          skipOrderConfirmationShown: true,
          seenLoanPaymentFailures: 0,
        },
      },
      version: 12,
    }))
  })
  await page.goto('./')

  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })

  const recoverOpen = progressDialog.getByRole('button', { name: '미국장 시작' })
  await expect(recoverOpen).toBeVisible()
  await recoverOpen.click()

  await expect(progressDialog.getByText(/저장된 시장 상태 복구/)).toBeVisible()
  await expect(page.getByText(/미국 장중/)).toBeVisible()
  await expect(page.getByLabel(/현재 날짜/)).toContainText('2018. 03. 13. (화)')
  await expect(page.getByLabel(/현재 날짜/)).toContainText('00:00')

  const close = progressDialog.getByRole('button', { name: '미국장 마감' })
  await expect(close).toBeVisible()
  await close.click()

  await expect(page.getByText(/미국 마감/)).toBeVisible()
  await expect(page.getByLabel(/현재 날짜/)).toContainText('04:59')
  await expect(progressDialog.getByText(/해당 시장이 시작되기 전에는 마감할 수 없습니다/)).toHaveCount(0)
})
