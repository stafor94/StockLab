import { chromium } from '@playwright/test'

const pages = [
  'https://indices.krx.co.kr/',
  'https://indices.krx.co.kr/main/main.jsp',
  'https://indices.krx.co.kr/contents/MKD/03/0304/03040200/MKD03040200.jsp',
  'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp',
]

const browser = await chromium.launch({ headless: true })
try {
  for (const pageUrl of pages) {
    const page = await browser.newPage()
    const seen = new Set<string>()
    page.on('response', async (response) => {
      const request = response.request()
      const url = response.url()
      if (!url.includes('krx.co.kr')) return
      if (!['xhr', 'fetch', 'document'].includes(request.resourceType())) return
      const signature = `${request.method()} ${url} ${request.postData() ?? ''}`
      if (seen.has(signature)) return
      seen.add(signature)
      console.log(`[KRX-NET] ${response.status()} ${request.resourceType()} ${signature}`)
    })

    try {
      const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
      console.log(`[KRX-PAGE] ${response?.status() ?? 'no-status'} ${pageUrl} -> ${page.url()}`)
      console.log(`[KRX-TITLE] ${await page.title()}`)
      const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))
      for (const script of scripts) console.log(`[KRX-SCRIPT] ${script}`)
      const labels = await page.locator('a, button').allTextContents()
      console.log(`[KRX-CONTROLS] ${labels.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 160).join(' | ')}`)
    } catch (error) {
      console.log(`[KRX-PAGE-ERROR] ${pageUrl} ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}
