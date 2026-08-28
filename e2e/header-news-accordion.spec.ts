import { expect, test, type Locator } from '@playwright/test'

async function expectPlainControl(locator: Locator) {
  const styles = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderTopStyle: style.borderTopStyle,
      borderTopWidth: style.borderTopWidth,
    }
  })
  expect(styles.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  expect(styles.borderTopStyle).toBe('none')
  expect(styles.borderTopWidth).toBe('0px')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stocklab.save', JSON.stringify({
    state: {
      gameDate: '2019-08-01',
      gameTimestamp: '2019-07-31T15:00:00.000Z',
      gameDisplayTimestamp: '2019-07-31T15:00:00.000Z',
      marketSessions: {
        KR: { phase: 'closed', tradingDate: '2019-07-31' },
        US: { phase: 'opened', tradingDate: '2019-07-31' },
      },
      guidance: { tutorialStatus: 'skipped', experienced: [], checklistCollapsed: true, skipOrderConfirmationShown: true },
    },
    version: 13,
  })))
})

test('header renders date, help, and settings without persistent surfaces', async ({ page }) => {
  await page.goto('./')

  const dateButton = page.locator('.app-game-date')
  const helpButton = page.getByRole('button', { name: '도움말' })
  const settingsButton = page.getByRole('button', { name: '설정' })

  await expect(dateButton).toBeVisible()
  await expect(dateButton).not.toContainText('현재 날짜')
  await expect(dateButton).toContainText('2019. 08. 01. (목)')
  await expect(dateButton).toContainText('00:00')
  await expectPlainControl(dateButton)
  await expectPlainControl(helpButton)
  await expectPlainControl(settingsButton)
})

test('news details expand below one list item at a time and toggle closed', async ({ page }) => {
  await page.goto('./')
  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByText('뉴스', { exact: true }).click()

  const entries = page.locator('.news-list-entry')
  await expect(entries.first()).toBeVisible()
  expect(await entries.count()).toBeGreaterThan(1)

  const firstEntry = entries.nth(0)
  const secondEntry = entries.nth(1)
  const firstButton = firstEntry.locator('.news-list-item')
  const secondButton = secondEntry.locator('.news-list-item')

  await expect(firstButton).toHaveAttribute('aria-expanded', 'false')
  await firstButton.click()
  await expect(firstButton).toHaveAttribute('aria-expanded', 'true')
  await expect(firstEntry.locator('.news-inline-article')).toBeVisible()
  await expect(page.locator('.news-inline-article')).toHaveCount(1)

  await secondButton.click()
  await expect(firstButton).toHaveAttribute('aria-expanded', 'false')
  await expect(firstEntry.locator('.news-inline-article')).toHaveCount(0)
  await expect(secondButton).toHaveAttribute('aria-expanded', 'true')
  await expect(secondEntry.locator('.news-inline-article')).toBeVisible()
  await expect(page.locator('.news-inline-article')).toHaveCount(1)

  await secondButton.click()
  await expect(secondButton).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.news-inline-article')).toHaveCount(0)
  await expect(page.locator('.news-article-panel')).toHaveCount(0)
})
