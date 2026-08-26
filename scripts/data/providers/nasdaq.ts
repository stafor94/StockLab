import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const NASDAQ_API_ROOT = 'https://api.nasdaq.com/api'
const REQUEST_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.nasdaq.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

export type NasdaqAssetClass = 'stocks' | 'etf' | 'index'

interface NasdaqRequestOptions {
  cachePath: string
  force: boolean
  delayMs: number
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function requestJson(url: URL, options: NasdaqRequestOptions): Promise<unknown> {
  if (!options.force) {
    const cached = await readJsonIfExists(options.cachePath)
    if (cached !== null) return cached
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (options.delayMs > 0) await sleep(options.delayMs)
    try {
      const response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) {
        const payload = await response.json() as unknown
        await writeJsonAtomic(options.cachePath, payload)
        return payload
      }
      lastError = new Error(`HTTP ${response.status}`)
      if (response.status !== 403 && response.status !== 429 && response.status < 500) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    await sleep(400 * (2 ** attempt))
  }
  throw new Error(`Nasdaq request failed for ${url.pathname}: ${lastError?.message ?? 'unknown error'}`)
}

export interface NasdaqHistoricalFetchOptions {
  symbol: string
  assetClass: NasdaqAssetClass
  from: string
  to: string
  limit?: number
  cacheRoot: string
  force: boolean
  delayMs: number
}

export async function fetchNasdaqHistoricalPayload(
  options: NasdaqHistoricalFetchOptions,
): Promise<unknown> {
  const url = new URL(`${NASDAQ_API_ROOT}/quote/${encodeURIComponent(options.symbol)}/historical`)
  url.searchParams.set('assetclass', options.assetClass)
  url.searchParams.set('fromdate', options.from)
  url.searchParams.set('todate', options.to)
  url.searchParams.set('limit', String(options.limit ?? 5000))
  const cachePath = join(
    options.cacheRoot,
    'nasdaq',
    'historical',
    options.assetClass,
    safeFileName(options.symbol),
    `${options.from}_${options.to}.json`,
  )
  return requestJson(url, { cachePath, force: options.force, delayMs: options.delayMs })
}

export interface NasdaqInfoFetchOptions {
  symbol: string
  assetClass: NasdaqAssetClass
  cacheRoot: string
  force: boolean
  delayMs: number
}

export async function fetchNasdaqInfoPayload(options: NasdaqInfoFetchOptions): Promise<unknown> {
  const url = new URL(`${NASDAQ_API_ROOT}/quote/${encodeURIComponent(options.symbol)}/info`)
  url.searchParams.set('assetclass', options.assetClass)
  const cachePath = join(
    options.cacheRoot,
    'nasdaq',
    'info',
    options.assetClass,
    `${safeFileName(options.symbol)}.json`,
  )
  return requestJson(url, { cachePath, force: options.force, delayMs: options.delayMs })
}

export interface NasdaqSplitCalendarFetchOptions {
  date: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

export async function fetchNasdaqSplitCalendarPayload(
  options: NasdaqSplitCalendarFetchOptions,
): Promise<unknown> {
  const url = new URL(`${NASDAQ_API_ROOT}/calendar/splits`)
  url.searchParams.set('date', options.date)
  const cachePath = join(options.cacheRoot, 'nasdaq', 'splits', `${options.date}.json`)
  return requestJson(url, { cachePath, force: options.force, delayMs: options.delayMs })
}

export function assertNasdaqInstrumentPayload(payload: unknown, _privateSymbol?: string): void {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Nasdaq instrument lookup returned a non-object response')
  }
  const data = (payload as Record<string, unknown>).data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Nasdaq does not recognize the private symbol for the requested asset class')
  }
}
