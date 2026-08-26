import { chromium } from '@playwright/test'

const pages = [
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

    const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
    console.log(`[KRX-PAGE] ${response?.status() ?? 'no-status'} ${pageUrl} -> ${page.url()}`)
    const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))
    for (const script of scripts) {
      if (!script.includes('/contents/MKD/')) continue
      console.log(`[KRX-SCRIPT] ${script}`)
      const jsResponse = await page.request.get(script)
      console.log(`[KRX-SCRIPT-STATUS] ${jsResponse.status()} ${script}`)
      const source = await jsResponse.text()
      source.split('\n').forEach((line, index) => {
        if (/ajax|jspx|json|excel|csv|download|mkd|url|action|query|search/i.test(line)) {
          console.log(`[KRX-JS:${index + 1}] ${line.trim()}`)
        }
      })
    }
  }
} finally {
  await browser.close()
}
