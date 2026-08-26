import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const KRX_DATA_URL = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'
const KRX_REFERER = 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC02010103'
const USER_AGENT = 'StockLab historical-data builder (+https://github.com/stafor94/StockLab)'

export interface KrxIndexHistoricalOptions {
  indexCode: string
  from: string
  to: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function fetchKrxIndexHistoricalPayload(options: KrxIndexHistoricalOptions): Promise<unknown> {
  const cachePath = join(
    options.cacheRoot,
    'krx-index',
    safeFileName(options.indexCode),
    `${options.from}_${options.to}.json`,
  )
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null) return cached
  }

  const indexGroup = options.indexCode.slice(0, 1)
  const indexNumber = options.indexCode.slice(1)
  if (!/^\d$/.test(indexGroup) || !/^\d{3}$/.test(indexNumber)) {
    throw new Error(`Invalid KRX index code: ${options.indexCode}`)
  }

  const form = new URLSearchParams({
    bld: 'dbms/MDC/STAT/standard/MDCSTAT00301',
    locale: 'ko_KR',
    indIdx: indexGroup,
    indIdx2: indexNumber,
    strtDd: options.from.replaceAll('-', ''),
    endDd: options.to.replaceAll('-', ''),
    share: '1',
    money: '1',
    csvxls_isNo: 'false',
  })

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const response = await fetch(KRX_DATA_URL, {
        method: 'POST',
        body: form,
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Referer: KRX_REFERER,
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json() as unknown
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload) || !Array.isArray((payload as Record<string, unknown>).output)) {
        throw new Error('unexpected KRX index response')
      }
      await writeJsonAtomic(cachePath, payload)
      return payload
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      await sleep(400 * (2 ** attempt))
    }
  }
  throw new Error(`KRX index request failed for ${options.indexCode} ${options.from}..${options.to}: ${lastError?.message ?? 'unknown error'}`)
}
