import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const KRX_OPEN_API_ROOT = 'https://data-dbg.krx.co.kr/svc/apis/idx'

export type KrxIndexEndpoint = 'kospi_dd_trd' | 'kosdaq_dd_trd'

export interface KrxIndexHistoricalOptions {
  endpoint: KrxIndexEndpoint
  date: string
  authKey: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

export async function fetchKrxIndexHistoricalPayload(options: KrxIndexHistoricalOptions): Promise<unknown> {
  const compactDate = options.date.replaceAll('-', '')
  if (!/^\d{8}$/.test(compactDate)) throw new Error(`Invalid KRX index date: ${options.date}`)
  if (!options.authKey.trim()) throw new Error('KRX_AUTH_KEY is required for official KRX index history')

  const cachePath = join(options.cacheRoot, 'krx-index', options.endpoint, `${compactDate}.json`)
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null) return cached
  }

  const url = new URL(`${KRX_OPEN_API_ROOT}/${options.endpoint}`)
  url.searchParams.set('basDd', compactDate)

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const response = await fetch(url, {
        headers: {
          AUTH_KEY: options.authKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) {
        const payload = await response.json() as unknown
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload) || !Array.isArray((payload as Record<string, unknown>).OutBlock_1)) {
          throw new Error('unexpected KRX Open API index response')
        }
        await writeJsonAtomic(cachePath, payload)
        return payload
      }
      lastError = new Error(`HTTP ${response.status}`)
      if (response.status === 401 || response.status === 403 || (response.status >= 400 && response.status < 429)) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    await sleep(400 * (2 ** attempt))
  }
  throw new Error(`KRX Open API ${options.endpoint} request failed for ${options.date}: ${lastError?.message ?? 'unknown error'}`)
}
