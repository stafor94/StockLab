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
      if (!['xhr', 'fetch'].includes(request.resourceType()) && request.method() === 'GET') return
      const signature = `${request.method()} ${request.resourceType()} ${request.url()} ${request.postData() ?? ''}`
      if (seen.has(signature)) return
      seen.add(signature)
      console.log(`[NET-REQUEST] ${signature}`)
    })
    page.on('response', async (response) => {
      const request = response.request()
      if (!['xhr', 'fetch', 'document'].includes(request.resourceType()) && request.method() === 'GET') return
      console.log(`[NET-RESPONSE] ${response.status()} ${request.resourceType()} ${request.method()} ${response.url()}`)
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

    const transportNodes = await page.locator('form, .CI-GRID-AREA, .CHART-AREA, [data-url], [data-bld], [data-query], [data-action]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).outerHTML.slice(0, 12_000)))
    transportNodes.forEach((html, index) => console.log(`[KRX-TRANSPORT:${index + 1}] ${html}`))

    const inlineScripts = await page.locator('script:not([src])').evaluateAll((nodes) => nodes.map((node) => node.textContent ?? '').filter((text) => /gridtable|bld|ajax|query|submit|search/i.test(text)))
    inlineScripts.forEach((source, index) => console.log(`[KRX-INLINE:${index + 1}] ${source.slice(0, 20_000)}`))

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

    const dateInput = page.locator('input[name="schdate"]').first()
    if (await dateInput.isVisible().catch(() => false)) {
      await dateInput.fill('20180102')
      console.log('[KRX-ACTION] schdate=20180102')
    }

    const searchControl = page.getByText('조회', { exact: true }).first()
    if (await searchControl.isVisible().catch(() => false)) {
      console.log('[KRX-ACTION] click 조회')
      await searchControl.click()
      await page.waitForTimeout(5_000)
      console.log(`[KRX-AFTER-QUERY-TEXT] ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 8_000)}`)
    }
  }

  const djiaUrl = 'https://api.nasdaq.com/api/quote/DJIA/historical?assetclass=index&fromdate=01%2F02%2F2018&todate=01%2F05%2F2018&limit=10'
  const djiaResponse = await fetch(djiaUrl, {
    headers: {
      accept: 'application/json, text/plain, */*',
      referer: 'https://www.nasdaq.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  })
  console.log(`[NASDAQ-DJIA] ${djiaResponse.status} ${djiaResponse.url}`)
  const djiaText = await djiaResponse.text()
  console.log(`[NASDAQ-DJIA-BODY] ${djiaText.slice(0, 3_000)}`)
} finally {
  await browser.close()
}
