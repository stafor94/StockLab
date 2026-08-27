import { expect, test } from '@playwright/test'

const AUTOPLAY_NEWS_HEADLINE = '자동진행 토스트 테스트 뉴스'

test.beforeEach(async ({ page }) => {
  await page.route('**/data/news/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const relativePath = pathname.split('/data/news/')[1]
    if (relativePath === 'manifest.json') {
      await route.fulfill({
        json: {
          schemaVersion: 1,
          coverage: { from: '2018-01-01', to: '2018-12-31' },
          source: { mode: 'curated', generatedAt: null },
          years: [{ year: 2018, path: '2018.json' }],
        },
      })
      return
    }
    if (relativePath === '2018.json') {
      await route.fulfill({
        json: {
          schemaVersion: 1,
          year: 2018,
          items: [{
            id: 'E2E-AUTOPLAY-NEWS-20180103',
            date: '2018-01-03',
            timing: 'PRE_OPEN',
            category: 'MARKET',
            market: 'KR',
            headline: AUTOPLAY_NEWS_HEADLINE,
            summary: '대출 납부일보다 먼저 공개되는 자동진행 토스트 회귀 테스트용 뉴스입니다.',
            article: ['자동진행 중 중요 뉴스가 팝업 대신 토스트로 표시되는지만 검증합니다.'],
            important: true,
            relatedAssetIds: [],
            relatedSectors: [],
            sourceReferences: ['https://example.test/autoplay-news'],
          }],
        },
      })
      return
    }
    await route.continue()
  })

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

test('game progress trigger is global and autoplay survives tab navigation', async ({ page }) => {
  await page.goto('./')
  const trigger = page.getByRole('button', { name: '게임 진행 열기' })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const progressDialog = page.getByRole('dialog', { name: '시간 진행' })
  await progressDialog.getByRole('button', { name: '자동진행' }).click()
  await expect(progressDialog.locator('.running-status')).toContainText('자동진행 1×')
  await progressDialog.getByRole('button', { name: '게임 진행 닫기' }).click()

  const navigation = page.getByRole('navigation', { name: '주 메뉴' })
  await navigation.getByText('시장', { exact: true }).click()
  await expect(trigger).toBeVisible()
  await expect(trigger).toContainText('자동진행 1×')
  await expect(page.locator('.app-game-date')).not.toContainText('00:00', { timeout: 3_000 })

  for (const tab of ['포트폴리오', '뉴스', '자산', '홈']) {
    await navigation.getByText(tab, { exact: true }).click()
    await expect(trigger).toBeVisible()
    await expect(trigger).toContainText('자동진행 1×')
  }

  await trigger.click()
  await expect(progressDialog.locator('.running-status')).toContainText('자동진행 1×')
  await progressDialog.getByRole('button', { name: '일시정지' }).click()
  await expect(progressDialog.locator('.running-status')).toHaveCount(0)
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

  const newsToast = page.getByRole('status').filter({ hasText: AUTOPLAY_NEWS_HEADLINE })
  await expect(newsToast).toBeVisible({ timeout: 12_000 })
  await expect(page.getByRole('dialog', { name: '중요 뉴스' })).toHaveCount(0)
  await expect(progressDialog.locator('.running-status')).toContainText('자동진행 30×')

  const loanAlert = page.getByRole('alertdialog', { name: '대출 자동출금 실패' })
  await expect(loanAlert).toBeVisible({ timeout: 12_000 })
  await expect(loanAlert).toContainText('2018-02-01')
  await expect(loanAlert).toContainText('연속 미납')
  await expect(progressDialog.locator('.running-status')).toHaveCount(0)
  await expect(progressDialog.getByRole('button', { name: '자동진행' })).toHaveCount(1)
})
