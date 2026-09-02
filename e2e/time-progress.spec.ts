import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('stocklab.save', JSON.stringify({
      state: {
        guidance: {
          tutorialStatus: 'skipped',
          experienced: [],
          checklistCollapsed: true,
          skipOrderConfirmationShown: true,
        },
      },
      version: 13,
    }))
  })
})

test('+1 month quick advance does not exceed the React update depth', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('./')
  await page.getByRole('button', { name: '게임 진행 열기' }).click()

  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  const monthAdvance = progressDialog.getByRole('button', { name: '+1개월' })
  await expect(monthAdvance).toBeEnabled()

  await monthAdvance.click()
  await expect(monthAdvance).toBeEnabled({ timeout: 20_000 })

  await expect(page.getByRole('heading', { name: 'StockLab' })).toBeVisible()
  await expect(progressDialog).toBeVisible()
  await expect(progressDialog.locator('.time-control-message')).not.toContainText(/Minified React error #185|Maximum update depth exceeded/)
  expect(pageErrors.filter((message) => /Minified React error #185|Maximum update depth exceeded/.test(message))).toEqual([])
})
