import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ASSET_CATALOG } from '../config/assets'
import { parseAssetPriceSeries } from '../src/data/schema'
import type { AssetPriceSeries, DailyBar } from '../src/types/market'
import { readJson } from '../scripts/data/io'

type SourceMapFile = {
  schemaVersion: 1
  assets: Record<string, { provider: string; assetClass?: string; symbol: string; [key: string]: unknown }>
}

type ScreenerRow = { symbol?: unknown; lastsale?: unknown; ipoyear?: unknown }
type Candidate = { symbol: string; lastSale: number | null; ipoYear: number | null }

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>
          high?: Array<number | null>
          low?: Array<number | null>
          close?: Array<number | null>
          volume?: Array<number | null>
        }>
      }
    }> | null
  }
}

const ROOT = process.cwd()
const SOURCE_MAP_PATH = join(ROOT, 'config', 'market-source-map.json')
const BRANCH = 'feature/keyless-market-cap-97-us-yahoo'
const NASDAQ_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.nasdaq.com/market-activity/stocks/screener',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}
const YAHOO_HEADERS = {
  accept: 'application/json,text/plain,*/*',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

const PRIORITY: Record<string, string[]> = {
  U001: ['NVDA'], U002: ['AMD'], U003: ['INTC'], U004: ['AVGO'],
  U005: ['MSFT'], U006: ['GOOGL', 'GOOG'], U007: ['AAPL'], U008: ['ORCL'],
  U009: ['TSLA'], U010: ['GM'], U011: ['F'], U012: ['ALB'],
  U013: ['APD', 'LIN'], U014: ['XOM'], U015: ['CVX'], U016: ['NEE'],
  U017: ['LLY', 'PFE', 'MRK'], U018: ['UNH'], U019: ['JNJ', 'ABBV'],
  U020: ['JPM'], U021: ['BAC'], U022: ['V'], U023: ['MA'],
  U024: ['BA'], U025: ['LMT'], U026: ['CAT'], U027: ['NUE'],
  U028: ['FCX'], U029: ['PG'], U030: ['KO'], U031: ['MCD'],
  U032: ['AMZN'], U033: ['WMT'], U034: ['COST'], U035: ['NFLX'],
  U036: ['DIS'], U037: ['CMCSA', 'WBD', 'PARA'], U038: ['T'], U039: ['VZ'],
  U040: ['PLTR', 'IBM'], U041: ['UBER'], U042: ['COIN'], U043: ['DAL'],
  U044: ['UPS'], U045: ['ABNB'],
}

function parseDollar(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parsed = Number(String(value).replace(/[$,]/g, '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseYear(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null
}

async function fetchNasdaqUniverse(): Promise<Candidate[]> {
  const url = new URL('https://api.nasdaq.com/api/screener/stocks')
  url.searchParams.set('tableonly', 'true')
  url.searchParams.set('limit', '10000')
  url.searchParams.set('offset', '0')
  url.searchParams.set('download', 'true')
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url, { headers: NASDAQ_HEADERS, signal: AbortSignal.timeout(20_000) })
      if (response.ok) {
        const payload = await response.json() as { data?: { rows?: ScreenerRow[] } }
        if (Array.isArray(payload.data?.rows)) {
          const seen = new Set<string>()
          return payload.data.rows.flatMap((row) => {
            const symbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : ''
            if (!symbol || seen.has(symbol) || !/^[A-Z0-9./-]{1,12}$/.test(symbol)) return []
            seen.add(symbol)
            return [{ symbol, lastSale: parseDollar(row.lastsale), ipoYear: parseYear(row.ipoyear) }]
          })
        }
      }
    } catch {
      // Retry without printing candidate values.
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)))
  }
  throw new Error('Official Nasdaq screener unavailable')
}

function unixDay(iso: string, offsetDays: number): number {
  const value = new Date(`${iso}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offsetDays)
  return Math.floor(value.getTime() / 1000)
}

const yahooCache = new Map<string, DailyBar[]>()

async function fetchYahooRecent(symbol: string, from: string, to: string): Promise<DailyBar[]> {
  const key = `${symbol}:${from}:${to}`
  const cached = yahooCache.get(key)
  if (cached) return cached
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
  for (const host of hosts) {
    const url = new URL(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}`)
    url.searchParams.set('period1', String(unixDay(from, -2)))
    url.searchParams.set('period2', String(unixDay(to, 3)))
    url.searchParams.set('interval', '1d')
    url.searchParams.set('events', 'history')
    url.searchParams.set('includeAdjustedClose', 'true')
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(12_000) })
        if (response.ok) {
          const payload = await response.json() as YahooChart
          const result = payload.chart?.result?.[0]
          const timestamps = result?.timestamp ?? []
          const quote = result?.indicators?.quote?.[0]
          if (!quote) break
          const bars: DailyBar[] = []
          for (let index = 0; index < timestamps.length; index += 1) {
            const open = quote.open?.[index]
            const high = quote.high?.[index]
            const low = quote.low?.[index]
            const close = quote.close?.[index]
            if (![open, high, low, close].every((value) => typeof value === 'number' && Number.isFinite(value))) continue
            bars.push({
              date: new Date(timestamps[index] * 1000).toISOString().slice(0, 10),
              open: open as number,
              high: high as number,
              low: low as number,
              close: close as number,
              volume: typeof quote.volume?.[index] === 'number' ? quote.volume[index]! : null,
            })
          }
          if (bars.length > 0) {
            yahooCache.set(key, bars)
            return bars
          }
        }
      } catch {
        // Retry verification source quietly.
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)))
    }
  }
  yahooCache.set(key, [])
  return []
}

function closeEnough(left: number, right: number): boolean {
  const tolerance = Math.max(0.03, Math.abs(right) * 0.0003)
  return Math.abs(left - right) <= tolerance
}

function barMatches(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date
    && closeEnough(left.open, right.open)
    && closeEnough(left.high, right.high)
    && closeEnough(left.low, right.low)
    && closeEnough(left.close, right.close)
}

async function candidateMatches(symbol: string, prices: AssetPriceSeries): Promise<boolean> {
  const expected = prices.bars.slice(-7)
  const actual = await fetchYahooRecent(symbol, expected[0].date, expected.at(-1)!.date)
  const byDate = new Map(actual.map((bar) => [bar.date, bar]))
  let compared = 0
  for (const bar of expected) {
    const candidate = byDate.get(bar.date)
    if (!candidate) continue
    compared += 1
    if (!barMatches(candidate, bar)) return false
  }
  return compared >= 5
}

async function persist(sourceMap: SourceMapFile, assetId: string): Promise<void> {
  await writeFile(SOURCE_MAP_PATH, `${JSON.stringify(sourceMap, null, 2)}\n`)
  execFileSync('git', ['add', 'config/market-source-map.json'], { stdio: 'inherit' })
  execFileSync('git', ['commit', '-m', `data: persist ${assetId} market source mapping`], { stdio: 'inherit' })
  execFileSync('git', ['push', 'origin', `HEAD:${BRANCH}`], { stdio: 'inherit' })
}

const sourceMap = await readJson(SOURCE_MAP_PATH) as SourceMapFile
if (sourceMap.schemaVersion !== 1) throw new Error('Tracked source map schema mismatch')
const universe = await fetchNasdaqUniverse()
const official = new Set(universe.map((item) => item.symbol))
console.log(`Official Nasdaq screener candidates loaded: ${universe.length}`)

for (const asset of ASSET_CATALOG.filter((item) => item.market === 'US' && item.kind === 'stock')) {
  const source = sourceMap.assets[asset.id]
  if (!source) throw new Error(`${asset.id}: tracked source entry missing`)
  if (source.symbol !== 'DUMMY') continue

  const prices = parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath))) as AssetPriceSeries
  const latest = prices.bars.at(-1)!
  const firstYear = Number(prices.bars[0].date.slice(0, 4))
  const fallback = universe
    .filter((candidate) => candidate.ipoYear === null || candidate.ipoYear <= firstYear)
    .filter((candidate) => candidate.lastSale !== null && candidate.lastSale >= latest.close * 0.5 && candidate.lastSale <= latest.close * 2)
    .sort((left, right) => Math.abs((left.lastSale ?? 0) - latest.close) - Math.abs((right.lastSale ?? 0) - latest.close))
    .slice(0, 80)
    .map((candidate) => candidate.symbol)
  const candidates = [...new Set([...(PRIORITY[asset.id] ?? []), ...fallback])]
  const matches: string[] = []
  for (const symbol of candidates) {
    if (!official.has(symbol)) continue
    if (await candidateMatches(symbol, prices)) matches.push(symbol)
    if (matches.length > 1) break
  }
  if (matches.length !== 1) throw new Error(`${asset.id}: verified U.S. identity count=${matches.length}`)

  source.provider = 'NASDAQ'
  source.assetClass = 'stocks'
  source.symbol = matches[0]
  delete source.candidates
  console.log(`${asset.id}: verified official identity and recent price history`)
  await persist(sourceMap, asset.id)
}

const unresolved = Object.entries(sourceMap.assets).filter(([id, source]) => /^U\d{3}$/.test(id) && source.symbol === 'DUMMY')
if (unresolved.length > 0) throw new Error(`Unresolved U.S. tracked mappings: ${unresolved.length}`)
console.log('Resolved all 45 U.S. tracked mappings.')
