import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const SEC_DATA_ROOT = 'https://data.sec.gov'
const SEC_WEB_ROOT = 'https://www.sec.gov'

export interface SecFetchOptions {
  cacheRoot: string
  force: boolean
  delayMs: number
  userAgent: string
}

type ResponseParser = (response: Response) => Promise<unknown>

async function requestJson(
  url: URL,
  cachePath: string,
  options: SecFetchOptions,
  parseResponse: ResponseParser = async (response) => await response.json() as unknown,
): Promise<unknown> {
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
          Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': options.userAgent,
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) {
        const payload = await parseResponse(response)
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

export function parseSecTickerText(text: string): Record<string, { ticker: string; cik_str: number }> {
  const entries = text.split(/\r?\n/).flatMap((line) => {
    const [tickerRaw, cikRaw] = line.trim().split('\t')
    const ticker = tickerRaw?.trim()
    const cik = Number(cikRaw)
    if (!ticker || !Number.isSafeInteger(cik) || cik <= 0) return []
    return [{ ticker, cik_str: cik }]
  })
  if (entries.length === 0) throw new Error('SEC ticker.txt contained no usable ticker/CIK mappings')
  return Object.fromEntries(entries.map((entry, index) => [String(index), entry]))
}

export function fetchSecCompanyTickers(options: SecFetchOptions): Promise<unknown> {
  return requestJson(
    new URL(`${SEC_WEB_ROOT}/include/ticker.txt`),
    join(options.cacheRoot, 'sec', 'company_tickers.json'),
    options,
    async (response) => parseSecTickerText(await response.text()),
  )
}

export function fetchSecCompanyFacts(cik: number, options: SecFetchOptions): Promise<unknown> {
  const padded = String(cik).padStart(10, '0')
  return requestJson(
    new URL(`${SEC_DATA_ROOT}/api/xbrl/companyfacts/CIK${padded}.json`),
    join(options.cacheRoot, 'sec', 'companyfacts', `CIK${padded}.json`),
    options,
  )
}

function tickerKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function resolveSecCikForTicker(payload: unknown, privateTicker: string): number {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('SEC ticker mapping must be an object')
  }
  const entries = Object.values(payload as Record<string, unknown>).flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return []
    const item = raw as Record<string, unknown>
    if (typeof item.ticker !== 'string' || typeof item.cik_str !== 'number') return []
    return [{ ticker: item.ticker.toUpperCase(), cik: item.cik_str }]
  })
  const exact = entries.filter((entry) => entry.ticker === privateTicker.toUpperCase())
  if (exact.length === 1) return exact[0].cik
  const normalized = entries.filter((entry) => tickerKey(entry.ticker) === tickerKey(privateTicker))
  if (normalized.length !== 1) throw new Error('SEC ticker mapping did not resolve the private U.S. symbol uniquely')
  return normalized[0].cik
}
