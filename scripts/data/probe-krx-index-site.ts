import { chromium } from '@playwright/test'

const pageUrl = 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp'
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage()
  const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  console.log(`[KRX-PAGE] ${response?.status() ?? 'no-status'} ${page.url()}`)

  const otpFunction = await page.evaluate(() => {
    const jq = (globalThis as unknown as { $: { otpCode: (kind: string, args: Record<string, string>) => string } }).$
    return String(jq.otpCode)
  })
  console.log(`[KRX-OTP-FUNCTION] ${otpFunction}`)

  const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))
  for (const script of scripts) {
    const jsResponse = await page.request.get(script)
    if (!jsResponse.ok()) continue
    const source = await jsResponse.text()
    const position = source.indexOf('otpCode')
    if (position < 0) continue
    console.log(`[KRX-OTP-SCRIPT] ${script}`)
    console.log(`[KRX-OTP-SOURCE] ${source.slice(Math.max(0, position - 1_500), position + 3_000)}`)
  }

  for (const classification of ['01', '02']) {
    const result = await page.evaluate(async ({ classification }) => {
      const jq = (globalThis as unknown as { $: { otpCode: (kind: string, args: Record<string, string>) => string } }).$
      const bld = '/IDX/03/0301/03010000/mkd03010000_04'
      const code = jq.otpCode('form', { bld })
      const body = new URLSearchParams({
        schdate: '20180102',
        lang: 'ko',
        idx_upclss_cd: classification,
        pagePath: '/contents/MKD/03/0301/03010000/MKD03010000T1.jsp',
        code,
      })
      const payloadResponse = await fetch('/contents/WWW/99/WWW99000001.jspx', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: body.toString(),
      })
      return {
        classification,
        code,
        status: payloadResponse.status,
        text: await payloadResponse.text(),
      }
    }, { classification })
    console.log(`[KRX-PAYLOAD:${classification}] status=${result.status} code=${result.code} body=${result.text.slice(0, 12_000)}`)
  }

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
      const nasdaqResponse = await fetch(url, { headers })
      const text = await nasdaqResponse.text()
      console.log(`[NASDAQ:${symbol}:${label}] ${nasdaqResponse.status} ${text.slice(0, 1_500)}`)
    }
  }
} finally {
  await browser.close()
}
