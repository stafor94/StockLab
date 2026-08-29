import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ASSET_CATALOG } from '../config/assets'
import { normalizeNasdaqHistoricalPayload } from '../src/data/ingestion/nasdaqHistorical'
import { parseAssetPriceSeries } from '../src/data/schema'
import type { AssetPriceSeries, DailyBar } from '../src/types/market'
import { readJson } from '../scripts/data/io'
import { VERIFIED_US_SPLIT_EVENTS } from '../scripts/data/us-split-events'

type SourceMapFile = {
  schemaVersion: 1
  assets: Record<string, { provider: string; assetClass?: string; symbol: string }>
}

const ROOT = process.cwd()
const SOURCE_MAP_PATH = join(ROOT, 'config', 'market-source-map.json')
const NASDAQ_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.nasdaq.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

const HINTS: Record<string, string[]> = {
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

function roundPrice(value: number): number {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000
}

function barsPriceEqual(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date
    && left.open === right.open
    && left.high === right.high
    && left.low === right.low
    && left.close === right.close
}

function fullyUnadjustedCandidateBar(assetId: string, bar: DailyBar): DailyBar {
  let factor = 1
  for (const event of VERIFIED_US_SPLIT_EVENTS) {
    if (event.assetId !== assetId || event.effectiveDate <= bar.date) continue
    factor *= event.numerator / event.denominator
  }
  if (Math.abs(factor - 1) < 1e-12) return bar
  return {
    ...bar,
    open: roundPrice(bar.open * factor),
    high: roundPrice(bar.high * factor),
    low: roundPrice(bar.low * factor),
    close: roundPrice(bar.close * factor),
  }
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function nasdaqDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year}`
}

async function fetchOneDay(symbol: string, date: string): Promise<DailyBar | null> {
  const url = new URL(`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical`)
  url.searchParams.set('assetclass', 'stocks')
  url.searchParams.set('fromdate', nasdaqDate(addDays(date, -3)))
  url.searchParams.set('todate', nasdaqDate(addDays(date, 3)))
  url.searchParams.set('limit', '20')
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: NASDAQ_HEADERS,
        signal: AbortSignal.timeout(20_000),
      })
      if (response.ok) {
        const bars = normalizeNasdaqHistoricalPayload(await response.json())
        return bars.find((bar) => bar.date === date) ?? null
      }
    } catch {
      // Retry the public Nasdaq Historical Quotes endpoint.
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)))
  }
  return null
}

async function matchesDate(assetId: string, symbol: string, expected: DailyBar): Promise<boolean> {
  const actual = await fetchOneDay(symbol, expected.date)
  if (!actual) return false
  return barsPriceEqual(actual, expected)
    || barsPriceEqual(fullyUnadjustedCandidateBar(assetId, actual), expected)
}

async function persist(sourceMap: SourceMapFile, assetId: string): Promise<void> {
  await writeFile(SOURCE_MAP_PATH, `${JSON.stringify(sourceMap, null, 2)}\n`)
  execFileSync('git', ['add', 'config/market-source-map.json'], { stdio: 'inherit' })
  execFileSync('git', ['commit', '-m', `data: persist ${assetId} market source mapping`], { stdio: 'inherit' })
  execFileSync('git', ['push', 'origin', 'HEAD:feature/keyless-market-cap-97-us-map'], { stdio: 'inherit' })
}

const sourceMap = await readJson(SOURCE_MAP_PATH) as SourceMapFile
if (sourceMap.schemaVersion !== 1) throw new Error('Tracked source map schema mismatch')

const unresolved: string[] = []
for (const asset of ASSET_CATALOG.filter((item) => item.market === 'US' && item.kind === 'stock')) {
  const source = sourceMap.assets[asset.id]
  if (!source || source.symbol !== 'DUMMY') continue
  const prices = parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath))) as AssetPriceSeries
  const first = prices.bars[0]
  const latest = prices.bars.at(-1)!
  let resolved: string | null = null
  for (const symbol of HINTS[asset.id] ?? []) {
    const firstMatch = await matchesDate(asset.id, symbol, first)
    if (!firstMatch) continue
    const latestMatch = await matchesDate(asset.id, symbol, latest)
    if (!latestMatch) continue
    resolved = symbol
    break
  }
  if (!resolved) {
    unresolved.push(asset.id)
    console.log(`${asset.id}: no two-date verified hint`)
    continue
  }
  source.provider = 'NASDAQ'
  source.assetClass = 'stocks'
  source.symbol = resolved
  console.log(`${asset.id}: verified on first and latest Nasdaq Historical Quotes dates`)
  await persist(sourceMap, asset.id)
}

console.log(`Two-date verified U.S. mappings unresolved: ${unresolved.length}`)
if (unresolved.length > 0) console.log(`Unresolved IDs: ${unresolved.join(',')}`)
