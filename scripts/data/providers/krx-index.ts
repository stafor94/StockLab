import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const KRX_INDEX_URL = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'
const KRX_INDEX_BLD = 'dbms/MDC/STAT/standard/MDCSTAT00301'
const REQUEST_HEADERS = {
  accept: 'application/json, text/javascript, */*; q=0.01',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  referer: 'https://data.krx.co.kr/contents/MDC/MDI/outerLoader/index.cmd',
  'user-agent': 'Mozilla/5.0',
  'x-requested-with': 'XMLHttpRequest',
}

export interface KrxIndexHistoricalOptions {
  indexCode: string
  from: string
  to: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

export async function fetchKrxIndexHistoricalPayload(options: KrxIndexHistoricalOptions): Promise<unknown> {
  if (!/^\d{4}$/.test(options.indexCode)) throw new Error(`Invalid KRX index code: ${options.indexCode}`)
  const from = options.from.replaceAll('-', '')
  const to = options.to.replaceAll('-', '')
  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to)) throw new Error('KRX index dates must use YYYY-MM-DD')

  const cachePath = join(options.cacheRoot, 'krx-index', options.indexCode, `${from}_${to}.json`)
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null) return cached
  }

  const body = new URLSearchParams({
    indIdx2: options.indexCode.slice(1),
    indIdx: options.indexCode[0],
    strtDd: from,
    endDd: to,
    bld: KRX_INDEX_BLD,
  })

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const response = await fetch(KRX_INDEX_URL, {
        method: 'POST',
        headers: REQUEST_HEADERS,
        body,
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) {
        const payload = await response.json() as unknown
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload) || !Array.isArray((payload as Record<string, unknown>).output)) {
          throw new Error('unexpected KRX Data Marketplace index response')
        }
        await writeJsonAtomic(cachePath, payload)
        return payload
      }
      lastError = new Error(`HTTP ${response.status}`)
      if (response.status >= 400 && response.status < 429) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    await sleep(400 * (2 ** attempt))
  }
  throw new Error(`KRX index request failed for ${options.indexCode} ${options.from}..${options.to}: ${lastError?.message ?? 'unknown error'}`)
}
