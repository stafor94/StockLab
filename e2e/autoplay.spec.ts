import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: {
      krwCash: 0,
      guidance: {
        tutorialStatus: 'skipped',
        experienced: [],
        checklistCollapsed: true,
        skipOrderConfirmationShown: true,
      },
    },
    version: 10,
  })))
})

test('30x autoplay uses toast notices for news and stops on loan payment failure', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '게임 진행 열기' }).click()
  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })

  const speed30 = progressDialog.getByRole('button', { name: '30×' })
  await expect(speed30).toBeVisible()
  await speed30.click()
  await expect(speed30).toHaveAttribute('aria-pressed', 'true')

  await progressDialog.getByRole('button', { name: '자동진행' }).click()
  await expect(progressDialog.getByText('자동진행 30×')).toBeVisible()

  const newsToast = page.getByRole('status').filter({ hasText: '영진전자, 50:1 액면분할 추진' })
  await expect(newsToast).toBeVisible({ timeout: 12_000 })
  await expect(page.getByRole('dialog', { name: '중요 뉴스' })).toHaveCount(0)

  const loanAlert = page.getByRole('alertdialog', { name: '대출 자동출금 실패' })
  await expect(loanAlert).toBeVisible({ timeout: 12_000 })
  await expect(loanAlert).toContainText('2018-02-01')
  await expect(loanAlert).toContainText('연속 미납')
  await expect(progressDialog.locator('.running-status')).toHaveCount(0)
  await expect(progressDialog.getByRole('button', { name: '자동진행' })).toHaveCount(1)
})
