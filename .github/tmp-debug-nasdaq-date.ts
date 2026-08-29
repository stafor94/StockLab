const headers = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.nasdaq.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

const cases = [
  ['iso-same', '2018-01-02', '2018-01-02'],
  ['slash-same', '01/02/2018', '01/02/2018'],
  ['iso-range', '2017-12-29', '2018-01-05'],
  ['slash-range', '12/29/2017', '01/05/2018'],
] as const

for (const [label, from, to] of cases) {
  const url = new URL('https://api.nasdaq.com/api/quote/NVDA/historical')
  url.searchParams.set('assetclass', 'stocks')
  url.searchParams.set('fromdate', from)
  url.searchParams.set('todate', to)
  url.searchParams.set('limit', '20')
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
  const payload = await response.json() as any
  const rows = payload?.data?.tradesTable?.rows ?? []
  console.log(JSON.stringify({
    label,
    status: response.status,
    totalRecords: payload?.data?.totalRecords ?? null,
    rowCount: Array.isArray(rows) ? rows.length : -1,
    dates: Array.isArray(rows) ? rows.slice(0, 5).map((row: any) => row.date) : [],
    sample: Array.isArray(rows) && rows.length ? {
      date: rows[0].date,
      open: rows[0].open,
      high: rows[0].high,
      low: rows[0].low,
      close: rows[0].close,
    } : null,
  }))
}
