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

const ROOT = process.cwd()
const SOURCE_MAP_PATH = join(ROOT, 'config', 'market-source-map.json')
const BRANCH = 'feature/keyless-market-cap-97'
const NASDAQ_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.nasdaq.com/market-activity/stocks/screener',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

// Prioritized candidates reduce verification traffic. They are never trusted by themselves:
// each accepted mapping must also exist in the live official Nasdaq screener and match
// the existing Nasdaq-derived price file across multiple recent sessions via Stooq.
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
  let lastStatus = 0
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url, { headers: NASDAQ_HEADERS, signal: AbortSignal.timeout(30_000) })
      lastStatus = response.status
      if (response.ok) {
        const payload = await response.json() as { data?: { rows?: ScreenerRow[] } }
        if (Array.isArray(payload.data?.rows)) {
          const seen = new Set<string>()
          const result: Candidate[] = []
          for (const row of payload.data.rows) {
            const symbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : ''
            if (!symbol || seen.has(symbol) || !/^[A-Z0-9./-]{1,12}$/.test(symbol)) continue
            seen.add(symbol)
            result.push({ symbol, lastSale: parseDollar(row.lastsale), ipoYear: parseYear(row.ipoyear) })
          }
          return result
        }
      }
    } catch {
      // Retry without printing candidate identities.
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)))
  }
  throw new Error(`Nasdaq official screener unavailable (status ${lastStatus || 'network'})`)
}

function dateCompact(iso: string): string {
  return iso.replaceAll('-', '')
}

function addDays(iso: string, days: number): string {
  const value = new Date(`${iso}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function stooqSymbol(symbol: string): string {
  return `${symbol.toLowerCase().replaceAll('.', '-').replaceAll('/', '-')}.us`
}

const stooqCache = new Map<string, DailyBar[]>()

async function fetchStooqRecent(symbol: string, from: string, to: string): Promise<DailyBar[]> {
  const key = `${symbol}:${from}:${to}`
  const cached = stooqCache.get(key)
  if (cached) return cached
  const url = new URL('https://stooq.com/q/d/l/')
  url.searchParams.set('s', stooqSymbol(symbol))
  url.searchParams.set('d1', dateCompact(from))
  url.searchParams.set('d2', dateCompact(to))
  url.searchParams.set('i', 'd')
  let lastStatus = 0
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'StockLab identity verifier' },
        signal: AbortSignal.timeout(20_000),
      })
      lastStatus = response.status
      if (response.ok) {
        const text = (await response.text()).trim()
        const lines = text.split(/\r?\n/)
        if (lines.length >= 2 && /^Date,Open,High,Low,Close,Volume/i.test(lines[0])) {
          const bars = lines.slice(1).flatMap((line) => {
            const [date, open, high, low, close, volume] = line.split(',')
            const nums = [open, high, low, close].map(Number)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || nums.some((value) => !Number.isFinite(value))) return []
            const parsedVolume = Number(volume)
            return [{
              date,
              open: nums[0],
              high: nums[1],
              low: nums[2],
              close: nums[3],
              volume: Number.isFinite(parsedVolume) ? parsedVolume : null,
            } satisfies DailyBar]
          })
          stooqCache.set(key, bars)
          return bars
        }
      }
    } catch {
      // Verification-only provider; retry quietly.
    }
    await new Promise((resolve) => setTimeout(resolve, 350 * (2 ** attempt)))
  }
  console.log(`Verification source unavailable for one candidate (status ${lastStatus || 'network'})`)
  stooqCache.set(key, [])
  return []
}

function closeEnough(left: number, right: number): boolean {
  const tolerance = Math.max(0.025, Math.abs(right) * 0.00025)
  return Math.abs(left - right) <= tolerance
}

function barsCloseEnough(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date
    && closeEnough(left.open, right.open)
    && closeEnough(left.high, right.high)
    && closeEnough(left.low, right.low)
    && closeEnough(left.close, right.close)
}

async function candidateMatches(symbol: string, prices: AssetPriceSeries): Promise<boolean> {
  const expected = prices.bars.slice(-6)
  const from = addDays(expected[0].date, -3)
  const to = addDays(expected.at(-1)!.date, 1)
  const actual = await fetchStooqRecent(symbol, from, to)
  const byDate = new Map(actual.map((bar) => [bar.date, bar]))
  let comparable = 0
  for (const bar of expected) {
    const candidate = byDate.get(bar.date)
    if (!candidate) continue
    comparable += 1
    if (!barsCloseEnough(candidate, bar)) return false
  }
  return comparable >= 4
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
const officialBySymbol = new Map(universe.map((candidate) => [candidate.symbol, candidate]))
console.log(`Official Nasdaq screener candidates loaded: ${universe.length}`)

for (const asset of ASSET_CATALOG.filter((item) => item.market === 'US' && item.kind === 'stock')) {
  const source = sourceMap.assets[asset.id]
  if (!source) throw new Error(`${asset.id}: tracked source entry missing`)
  if (source.symbol !== 'DUMMY') continue

  const prices = parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath))) as AssetPriceSeries
  const latest = prices.bars.at(-1)!
  const firstYear = Number(prices.bars[0].date.slice(0, 4))
  const prioritized = PRIORITY[asset.id] ?? []
  const fallback = universe
    .filter((candidate) => candidate.ipoYear === null || candidate.ipoYear <= firstYear)
    .filter((candidate) => candidate.lastSale !== null && candidate.lastSale >= latest.close * 0.45 && candidate.lastSale <= latest.close * 2.2)
    .sort((left, right) => Math.abs((left.lastSale ?? 0) - latest.close) - Math.abs((right.lastSale ?? 0) - latest.close))
    .slice(0, 120)
    .map((candidate) => candidate.symbol)
  const symbols = [...new Set([...prioritized, ...fallback])]

  const matches: string[] = []
  for (const symbol of symbols) {
    if (!officialBySymbol.has(symbol)) continue
    if (await candidateMatches(symbol, prices)) matches.push(symbol)
    if (matches.length > 1) break
  }
  if (matches.length !== 1) {
    throw new Error(`${asset.id}: verified U.S. identity count=${matches.length}`)
  }

  source.provider = 'NASDAQ'
  source.assetClass = 'stocks'
  source.symbol = matches[0]
  delete source.candidates
  console.log(`${asset.id}: verified official identity and recent price history`)
  await persist(sourceMap, asset.id)
}

const unresolved = Object.entries(sourceMap.assets)
  .filter(([assetId, source]) => /^U\d{3}$/.test(assetId) && source.symbol === 'DUMMY')
  .map(([assetId]) => assetId)
if (unresolved.length > 0) throw new Error(`Unresolved U.S. tracked mappings: ${unresolved.length}`)
console.log('Resolved all 45 U.S. tracked mappings.')
