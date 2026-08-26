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
    page.on('request', (request) => {
      const url = request.url()
      if (!url.includes('krx.co.kr')) return
      if (!['xhr', 'fetch'].includes(request.resourceType())) return
      const signature = `${request.method()} ${url} ${request.postData() ?? ''}`
      if (seen.has(signature)) return
      seen.add(signature)
      console.log(`[KRX-REQUEST] ${request.resourceType()} ${signature}`)
    })
    page.on('response', async (response) => {
      const request = response.request()
      const url = response.url()
      if (!url.includes('krx.co.kr')) return
      if (!['xhr', 'fetch', 'document'].includes(request.resourceType())) return
      console.log(`[KRX-RESPONSE] ${response.status()} ${request.resourceType()} ${request.method()} ${url}`)
    })

    const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
    console.log(`[KRX-PAGE] ${response?.status() ?? 'no-status'} ${pageUrl} -> ${page.url()}`)

    const controls = await page.locator('input, select, button, a').evaluateAll((nodes) => nodes.map((node) => {
      const element = node as HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLAnchorElement
      return {
        tag: element.tagName,
        type: 'type' in element ? element.type : '',
        id: element.id,
        name: 'name' in element ? element.name : '',
        value: 'value' in element ? element.value : '',
        text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      }
    }).filter((item) => item.id || item.name || item.text === '조회'))
    console.log(`[KRX-CONTROLS] ${JSON.stringify(controls)}`)

    const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))
    for (const script of scripts) {
      if (!script.includes('/contents/MKD/')) continue
      console.log(`[KRX-SCRIPT] ${script}`)
      const jsResponse = await page.request.get(script)
      console.log(`[KRX-SCRIPT-STATUS] ${jsResponse.status()} ${script}`)
      const source = await jsResponse.text()
      source.split('\n').forEach((line, index) => {
        const trimmed = line.trim()
        if (trimmed) console.log(`[KRX-JS:${index + 1}] ${trimmed}`)
      })
    }

    const searchControl = page.getByText('조회', { exact: true }).first()
    if (await searchControl.isVisible().catch(() => false)) {
      console.log('[KRX-ACTION] click 조회')
      await searchControl.click()
      await page.waitForTimeout(5_000)
    } else {
      const searchInput = page.locator('input[type="button"][value="조회"], input[type="submit"][value="조회"]').first()
      if (await searchInput.isVisible().catch(() => false)) {
        console.log('[KRX-ACTION] click 조회 input')
        await searchInput.click()
        await page.waitForTimeout(5_000)
      }
    }
  }
} finally {
  await browser.close()
}
