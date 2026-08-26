const krxPage = 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp'
const krxBld = '/IDX/03/0301/03010000/mkd03010000_04'
const krxHeaders = {
  accept: '*/*',
  referer: krxPage,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
}

type KrxRow = { idx_nm?: string; idx_ind_cd?: string; ind_tp_cd?: string; clsprc_idx?: string }
type KrxPayload = { block1?: KrxRow[] }

for (let code = 1; code <= 12; code += 1) {
  const classification = String(code).padStart(2, '0')
  const otpUrl = new URL('https://indices.krx.co.kr/contents/COM/GenerateOTP.jspx')
  otpUrl.searchParams.set('bld', krxBld)
  otpUrl.searchParams.set('name', 'form')
  const otpResponse = await fetch(otpUrl, { headers: krxHeaders })
  const otp = (await otpResponse.text()).trim()
  if (!otpResponse.ok || !otp) {
    console.log(`[KRX:${classification}] OTP ${otpResponse.status}`)
    continue
  }

  const body = new URLSearchParams({
    schdate: '20180102',
    lang: 'ko',
    idx_upclss_cd: classification,
    pagePath: '/contents/MKD/03/0301/03010000/MKD03010000T1.jsp',
    code: otp,
  })
  const dataResponse = await fetch('https://indices.krx.co.kr/contents/WWW/99/WWW99000001.jspx', {
    method: 'POST',
    headers: {
      ...krxHeaders,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  })
  const text = await dataResponse.text()
  let rows: KrxRow[] = []
  try {
    const payload = JSON.parse(text) as KrxPayload
    rows = Array.isArray(payload.block1) ? payload.block1 : []
  } catch {
    console.log(`[KRX:${classification}] ${dataResponse.status} non-JSON ${text.slice(0, 300)}`)
    continue
  }
  const kosdaqRows = rows.filter((row) => row.idx_nm?.includes('코스닥'))
  console.log(`[KRX:${classification}] status=${dataResponse.status} rows=${rows.length} first=${JSON.stringify(rows.slice(0, 5))} kosdaq=${JSON.stringify(kosdaqRows.slice(0, 10))}`)
}

const nasdaqHeaders = {
  accept: 'application/json, text/plain, */*',
  referer: 'https://www.nasdaq.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}
const nasdaqCandidates = ['COMP', 'DJI', 'DJIA', 'INDU', 'DJX', 'DOW', '^DJI', '.DJI', '$INDU']
for (const assetClass of ['index', 'indexes']) {
  for (const symbol of nasdaqCandidates) {
    const url = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical`)
    url.searchParams.set('assetclass', assetClass)
    url.searchParams.set('fromdate', '2018-01-02')
    url.searchParams.set('todate', '2018-01-05')
    url.searchParams.set('limit', '10')
    const response = await fetch(url, { headers: nasdaqHeaders })
    const payload = await response.json().catch(() => null) as { data?: { symbol?: string; totalRecords?: number } | null; status?: { rCode?: number; bCodeMessage?: unknown } } | null
    console.log(`[NASDAQ:${assetClass}:${symbol}] http=${response.status} rCode=${payload?.status?.rCode ?? 'n/a'} symbol=${payload?.data?.symbol ?? 'null'} records=${payload?.data?.totalRecords ?? 'null'} message=${JSON.stringify(payload?.status?.bCodeMessage ?? null)}`)
  }
}
