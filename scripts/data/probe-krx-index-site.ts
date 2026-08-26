export {}

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

async function probe(label: string, url: string): Promise<void> {
  const response = await fetch(url, { headers: nasdaqHeaders })
  const text = await response.text()
  console.log(`[NASDAQ:${label}] http=${response.status} ${text.slice(0, 5000)}`)
}

await probe('index-screener', 'https://api.nasdaq.com/api/screener/index?download=true')
for (const symbol of ['INDU', 'DJI', 'DJIA', 'DJX', 'DOW']) {
  await probe(`${symbol}:chart`, `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/chart?assetclass=index`)
  await probe(`${symbol}:info`, `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=index`)
}
await probe('autosuggest', 'https://www.nasdaq.com/ai-search/external/content-search-bff/v1/autosuggest?query=Dow%20Jones%20Industrial%20Average')
