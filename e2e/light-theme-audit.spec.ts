import { expect, test, type Page } from '@playwright/test'

async function installThemeProbe(page: Page) {
  await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.id = 'theme-semantic-probe'
    probe.setAttribute('aria-hidden', 'true')
    probe.innerHTML = `
      <div class="autoplay-toast" data-probe="toast">toast</div>
      <div class="fx-unavailable"><strong data-probe="warning">warning</strong></div>
      <div class="investment-loan-compact is-danger"><small data-probe="danger">danger</small></div>
      <button class="context-help-link" data-probe="accent" type="button">help</button>
      <div class="market-flow-guide opened" data-probe="opened">opened</div>
      <div class="asset-list-row active"><div class="asset-list-copy"><strong data-probe="active-asset">asset</strong></div></div>
      <div class="order-preview-total"><strong data-probe="order-total">total</strong></div>
      <p class="trade-message" data-probe="trade-message">message</p>
      <div class="tutorial-dialog"><p class="section-kicker" data-probe="tutorial">tutorial</p></div>
      <div class="trade-side-tabs"><button class="active sell" data-probe="sell" type="button">sell</button></div>
      <div class="trading-dialog-state warning-state" data-probe="dialog-warning">warning</div>
    `
    probe.style.position = 'fixed'
    probe.style.left = '-10000px'
    probe.style.top = '0'
    document.body.append(probe)
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('stocklab.theme', 'light')
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

test('white mode keeps shared surfaces and semantic states readable across screens', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  const progressTrigger = page.getByRole('button', { name: '게임 진행 열기' })
  await expect(progressTrigger).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(progressTrigger.locator('strong')).toHaveCSS('color', 'rgb(23, 25, 29)')

  await page.getByLabel(/현재 날짜/).click()
  const weekdays = page.locator('.market-calendar-weekdays span')
  await expect(weekdays.first()).toHaveCSS('color', 'rgb(189, 47, 60)')
  await expect(weekdays.last()).toHaveCSS('color', 'rgb(36, 94, 184)')
  await page.getByRole('button', { name: '시장 캘린더 닫기' }).click()

  await installThemeProbe(page)
  const probe = page.locator('#theme-semantic-probe')
  await expect(probe.locator('[data-probe="toast"]')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(probe.locator('[data-probe="warning"]')).toHaveCSS('color', 'rgb(135, 85, 13)')
  await expect(probe.locator('[data-probe="dialog-warning"]')).toHaveCSS('color', 'rgb(135, 85, 13)')
  await expect(probe.locator('[data-probe="danger"]')).toHaveCSS('color', 'rgb(189, 47, 60)')
  await expect(probe.locator('[data-probe="accent"]')).toHaveCSS('color', 'rgb(63, 95, 207)')
  await expect(probe.locator('[data-probe="opened"]')).toHaveCSS('color', 'rgb(63, 95, 207)')
  await expect(probe.locator('[data-probe="active-asset"]')).toHaveCSS('color', 'rgb(63, 95, 207)')
  await expect(probe.locator('[data-probe="order-total"]')).toHaveCSS('color', 'rgb(63, 95, 207)')
  await expect(probe.locator('[data-probe="trade-message"]')).toHaveCSS('color', 'rgb(63, 95, 207)')
  await expect(probe.locator('[data-probe="tutorial"]')).toHaveCSS('color', 'rgb(63, 95, 207)')
  await expect(probe.locator('[data-probe="sell"]')).toHaveCSS('color', 'rgb(36, 94, 184)')
})

test('semantic audit keeps the existing dark palette intact', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.theme', 'dark'))
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const progressTrigger = page.getByRole('button', { name: '게임 진행 열기' })
  await expect(progressTrigger).toHaveCSS('background-color', 'rgb(24, 27, 32)')
  await expect(progressTrigger.locator('strong')).toHaveCSS('color', 'rgb(244, 245, 247)')

  await installThemeProbe(page)
  const probe = page.locator('#theme-semantic-probe')
  await expect(probe.locator('[data-probe="accent"]')).toHaveCSS('color', 'rgb(154, 175, 255)')
  await expect(probe.locator('[data-probe="warning"]')).toHaveCSS('color', 'rgb(240, 196, 108)')
  await expect(probe.locator('[data-probe="danger"]')).toHaveCSS('color', 'rgb(255, 140, 149)')
  await expect(probe.locator('[data-probe="sell"]')).toHaveCSS('color', 'rgb(119, 165, 255)')
})
