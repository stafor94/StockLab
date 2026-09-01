import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const SEC_DATA_ROOT = 'https://data.sec.gov'

export interface SecFetchOptions {
  cacheRoot: string
  force: boolean
  delayMs: number
  userAgent: string
}

async function requestJson(url: URL, cachePath: string, options: SecFetchOptions): Promise<unknown> {
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null) return cached
  }
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': options.userAgent,
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) {
        const payload = await response.json() as unknown
        await writeJsonAtomic(cachePath, payload)
        return payload
      }
      lastError = new Error(`HTTP ${response.status}`)
      if (response.status !== 403 && response.status !== 429 && response.status < 500) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    await sleep(500 * (2 ** attempt))
  }
  throw new Error(`SEC request failed for ${url.pathname}: ${lastError?.message ?? 'unknown error'}`)
}

export function fetchSecCompanyFacts(cik: number, options: SecFetchOptions): Promise<unknown> {
  const padded = String(cik).padStart(10, '0')
  return requestJson(
    new URL(`${SEC_DATA_ROOT}/api/xbrl/companyfacts/CIK${padded}.json`),
    join(options.cacheRoot, 'sec', 'companyfacts', `CIK${padded}.json`),
    options,
  )
}
