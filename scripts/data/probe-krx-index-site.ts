import { chromium } from '@playwright/test'

const headers = {
  accept: 'application/json, text/plain, */*',
  referer: 'https://www.nasdaq.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}
const formats = [
  ['slash', '01/02/2018', '01/05/2018'],
  ['iso', '2018-01-02', '2018-01-05'],
  ['dash-us', '01-02-2018', '01-05-2018'],
  ['compact', '01022018', '01052018'],
] as const

for (const symbol of ['COMP', 'DJIA']) {
  for (const [label, from, to] of formats) {
    const url = new URL(`https://api.nasdaq.com/api/quote/${symbol}/historical`)
    url.searchParams.set('assetclass', 'index')
    url.searchParams.set('fromdate', from)
    url.searchParams.set('todate', to)
    url.searchParams.set('limit', '10')
    const response = await fetch(url, { headers })
    const text = await response.text()
    console.log(`[NASDAQ:${symbol}:${label}] ${response.status} ${text.slice(0, 2_000)}`)
  }
}

const pageUrl = 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  console.log(`[KRX-PAGE] ${response?.status() ?? 'no-status'} ${page.url()}`)

  const globalProbe = await page.evaluate(() => ({
    dollar: (0, eval)('typeof $'),
    jquery: (0, eval)('typeof jQuery'),
  }))
  console.log(`[KRX-GLOBALS] ${JSON.stringify(globalProbe)}`)

  const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))
  console.log(`[KRX-SCRIPT-COUNT] ${scripts.length}`)
  for (const script of scripts) {
    const jsResponse = await page.request.get(script)
    if (!jsResponse.ok()) continue
    const source = await jsResponse.text()
    const position = source.indexOf('otpCode')
    if (position < 0) continue
    console.log(`[KRX-OTP-SCRIPT] ${script}`)
    console.log(`[KRX-OTP-SOURCE] ${source.slice(Math.max(0, position - 3_000), position + 6_000)}`)
  }
} finally {
  await browser.close()
}
