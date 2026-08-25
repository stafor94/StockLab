import { join } from 'node:path'
import { readJsonIfExists, sleep, writeJsonAtomic } from '../io'

const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query'

export interface AlphaVantageFetchOptions {
  symbol: string
  apiKey: string
  cacheRoot: string
  force: boolean
  delayMs: number
}

function safeFileName(symbol: string): string {
  return symbol.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function providerMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'non-object response'
  }
  const root = payload as Record<string, unknown>
  for (const key of ['Error Message', 'Note', 'Information']) {
    const value = root[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

export async function fetchAlphaVantageDailyPayload(
  options: AlphaVantageFetchOptions,
): Promise<unknown> {
  const cachePath = join(options.cacheRoot, 'alpha-vantage', `${safeFileName(options.symbol)}.json`)

  if (!options.force) {
    const cached = await readJsonIfExists(cachePath)
    if (cached !== null) {
      return cached
    }
  }

  await sleep(options.delayMs)
  const url = new URL(ALPHA_VANTAGE_URL)
  url.searchParams.set('function', 'TIME_SERIES_DAILY')
  url.searchParams.set('symbol', options.symbol)
  url.searchParams.set('outputsize', 'full')
  url.searchParams.set('datatype', 'json')
  url.searchParams.set('apikey', options.apiKey)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed with HTTP ${response.status}`)
  }
  const payload = await response.json() as unknown
  const message = providerMessage(payload)
  if (message) {
    throw new Error(`Alpha Vantage rejected ${options.symbol}: ${message}`)
  }

  await writeJsonAtomic(cachePath, payload)
  return payload
}
