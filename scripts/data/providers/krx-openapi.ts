import { join } from 'node:path'
import { normalizeKrxOpenApiMarketCapPayload, type KrxOpenApiMarketCapRow } from '../../../src/data/ingestion/krxOpenApiMarketCap'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'
import type { KrxEndpoint } from '../source-map'

const KRX_OPEN_API_ROOT = 'https://data-dbg.krx.co.kr/svc/apis'
const ENDPOINT_PATH: Record<KrxEndpoint, string> = {
  stk_bydd_trd: 'sto/stk_bydd_trd',
  ksq_bydd_trd: 'sto/ksq_bydd_trd',
  etf_bydd_trd: 'etp/etf_bydd_trd',
}

export interface KrxOpenApiFetchOptions {
  endpoint: KrxEndpoint
  date: string
  expectedSymbols: ReadonlySet<string>
  authKey: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

export async function fetchKrxOpenApiMarketCapRows(options: KrxOpenApiFetchOptions): Promise<KrxOpenApiMarketCapRow[]> {
  const cachePath = join(options.cacheRoot, 'krx-openapi', options.endpoint, `${options.date}.json`)
  let payload = options.force ? null : await readJsonIfExists(cachePath)
  if (payload === null) {
    const url = new URL(`${KRX_OPEN_API_ROOT}/${ENDPOINT_PATH[options.endpoint]}`)
    url.searchParams.set('basDd', options.date.replaceAll('-', ''))
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (options.delayMs > 0) await sleep(options.delayMs)
      try {
        const response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            AUTH_KEY: options.authKey,
            'User-Agent': 'StockLab historical market-cap builder (+https://github.com/stafor94/StockLab)',
          },
          signal: AbortSignal.timeout(30_000),
        })
        if (response.ok) {
          payload = await response.json() as unknown
          await writeJsonAtomic(cachePath, payload)
          break
        }
        lastError = new Error(`HTTP ${response.status}`)
        if (response.status !== 429 && response.status < 500) break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
      await sleep(500 * (2 ** attempt))
    }
    if (payload === null) {
      throw new Error(`KRX OPEN API ${options.endpoint} ${options.date} failed: ${lastError?.message ?? 'unknown error'}`)
    }
  }
  return normalizeKrxOpenApiMarketCapPayload(payload, options.date, options.expectedSymbols)
}
