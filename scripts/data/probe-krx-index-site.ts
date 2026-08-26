const krxPage = 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp'
const krxBld = '/IDX/03/0301/03010000/mkd03010000_04'
const krxHeaders = {
  accept: '*/*',
  referer: krxPage,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
}

for (const name of ['form', 'grid']) {
  for (const classification of ['01', '02']) {
    const otpUrl = new URL('https://indices.krx.co.kr/contents/COM/GenerateOTP.jspx')
    otpUrl.searchParams.set('bld', krxBld)
    otpUrl.searchParams.set('name', name)
    const otpResponse = await fetch(otpUrl, { headers: krxHeaders })
    const otp = (await otpResponse.text()).trim()
    console.log(`[KRX-OTP:${name}:${classification}] ${otpResponse.status} ${otp.slice(0, 48)}...`)
    if (!otpResponse.ok || !otp) continue

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
    console.log(`[KRX-DATA:${name}:${classification}] ${dataResponse.status} ${text.slice(0, 12_000)}`)
  }
}

const nasdaqHeaders = {
  accept: 'application/json, text/plain, */*',
  referer: 'https://www.nasdaq.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}
for (const symbol of ['COMP', 'INDU']) {
  const url = new URL(`https://api.nasdaq.com/api/quote/${symbol}/historical`)
  url.searchParams.set('assetclass', 'index')
  url.searchParams.set('fromdate', '2018-01-02')
  url.searchParams.set('todate', '2018-01-05')
  url.searchParams.set('limit', '10')
  const response = await fetch(url, { headers: nasdaqHeaders })
  const text = await response.text()
  console.log(`[NASDAQ:${symbol}] ${response.status} ${text.slice(0, 3_000)}`)
}
