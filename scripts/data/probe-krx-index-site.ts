export {}

const krxPage = 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp'
const krxBld = '/IDX/03/0301/03010000/mkd03010000_04'
const krxHeaders = {
  accept: '*/*',
  referer: krxPage,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
}

type JsonRecord = Record<string, unknown>
type KrxRow = { idx_nm?: string; idx_ind_cd?: string; ind_tp_cd?: string; clsprc_idx?: string }
type KrxPayload = { block1?: KrxRow[] }

const otpUrl = new URL('https://indices.krx.co.kr/contents/COM/GenerateOTP.jspx')
otpUrl.searchParams.set('bld', krxBld)
otpUrl.searchParams.set('name', 'form')
const otpResponse = await fetch(otpUrl, { headers: krxHeaders })
const otp = (await otpResponse.text()).trim()
if (otpResponse.ok && otp) {
  const body = new URLSearchParams({
    schdate: '20180102',
    lang: 'ko',
    idx_upclss_cd: '01',
    pagePath: '/contents/MKD/03/0301/03010000/MKD03010000T1.jsp',
    code: otp,
  })
  const response = await fetch('https://indices.krx.co.kr/contents/WWW/99/WWW99000001.jspx', {
    method: 'POST',
    headers: { ...krxHeaders, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
  })
  const payload = await response.json() as KrxPayload
  const rows = Array.isArray(payload.block1) ? payload.block1 : []
  const representatives = rows.filter((row) => row.ind_tp_cd === 'Z' && ['001', '002'].includes(row.idx_ind_cd ?? ''))
  console.log(`[KRX] http=${response.status} representatives=${JSON.stringify(representatives)}`)
} else {
  console.log(`[KRX] OTP http=${otpResponse.status}`)
}

const nasdaqHeaders = {
  accept: 'application/json, text/plain, */*',
  referer: 'https://www.nasdaq.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null
}

async function fetchJson(url: string): Promise<{ response: Response; payload: unknown }> {
  const response = await fetch(url, { headers: nasdaqHeaders })
  const payload = await response.json().catch(() => null) as unknown
  return { response, payload }
}

const screener = await fetchJson('https://api.nasdaq.com/api/screener/index?limit=10000')
const screenerRoot = asRecord(screener.payload)
const screenerData = asRecord(screenerRoot?.data)
const records = asRecord(screenerData?.records)
const recordsData = asRecord(records?.data)
const screenerRows = Array.isArray(recordsData?.rows) ? recordsData.rows : []
const dowRows = screenerRows.filter((value) => {
  const row = asRecord(value)
  const haystack = [row?.symbol, row?.name, row?.companyName, row?.indexName]
    .map((item) => String(item ?? '').toLowerCase())
    .join(' ')
  return haystack.includes('dow') || haystack.includes('industrial') || haystack.includes('jones')
})
console.log(`[NASDAQ:index-screener] http=${screener.response.status} rows=${screenerRows.length} dow=${JSON.stringify(dowRows.slice(0, 30))}`)

const candidates = new Set([
  'INDU', 'DJI', 'DJIA', '.DJIA', '.DJI', '^DJI', '$INDU', 'DJX', 'DOW',
  'DJIA.IND', 'DJIA:IND', 'INDEX/US/DOW JONES GLOBAL/DJIA',
])
for (const value of dowRows) {
  const row = asRecord(value)
  const symbol = String(row?.symbol ?? '').trim()
  if (symbol) candidates.add(symbol)
}

for (const symbol of candidates) {
  for (const assetClass of ['index', 'stocks']) {
    const historicalUrl = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical`)
    historicalUrl.searchParams.set('assetclass', assetClass)
    historicalUrl.searchParams.set('fromdate', '2018-01-02')
    historicalUrl.searchParams.set('todate', '2018-01-05')
    historicalUrl.searchParams.set('limit', '10')
    const historical = await fetchJson(historicalUrl.toString())
    const root = asRecord(historical.payload)
    const data = asRecord(root?.data)
    const status = asRecord(root?.status)
    console.log(`[NASDAQ:historical:${assetClass}:${symbol}] http=${historical.response.status} rCode=${String(status?.rCode ?? '')} dataSymbol=${String(data?.symbol ?? '')} totalRecords=${String(data?.totalRecords ?? '')} message=${JSON.stringify(status?.bCodeMessage ?? null)}`)
  }
}
