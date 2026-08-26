import { chromium } from '@playwright/test'

const pageUrl = 'https://index.krx.co.kr/contents/MKD/03/0304/03040200/MKD03040200.jsp'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const seen = new Set<string>()
  page.on('response', async (response) => {
    const request = response.request()
    const url = response.url()
    if (!url.startsWith('https://index.krx.co.kr/')) return
    if (!['xhr', 'fetch', 'document'].includes(request.resourceType())) return
    const signature = `${request.method()} ${url} ${request.postData() ?? ''}`
    if (seen.has(signature)) return
    seen.add(signature)
    console.log(`[KRX-NET] ${response.status()} ${request.resourceType()} ${signature}`)
  })

  const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  console.log(`[KRX-PAGE] ${response?.status() ?? 'no-status'} ${page.url()}`)
  const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))
  for (const script of scripts) console.log(`[KRX-SCRIPT] ${script}`)

  const labels = await page.locator('a, button').allTextContents()
  console.log(`[KRX-CONTROLS] ${labels.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 120).join(' | ')}`)

  const kospi = page.getByText('코스피', { exact: true }).first()
  if (await kospi.isVisible().catch(() => false)) {
    console.log('[KRX-PROBE] clicking visible 코스피 control')
    await kospi.click()
    await page.waitForTimeout(4_000)
    console.log(`[KRX-AFTER-CLICK] ${page.url()}`)
  } else {
    console.log('[KRX-PROBE] exact 코스피 control not visible on series page')
  }
} finally {
  await browser.close()
}
