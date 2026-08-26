import { join } from 'node:path'
import { normalizeKrxIndexDailyPayload, type KrxMajorIndex } from '../../src/data/ingestion/krxIndex'
import { nasdaqHistoricalTotalRecords, normalizeNasdaqHistoricalPayload } from '../../src/data/ingestion/nasdaqHistorical'
import { parseMarketCalendar } from '../../src/data/schema'
import type { DailyBar, MarketCalendar, MarketCode } from '../../src/types/market'
import type { MarketIndexManifest, MarketIndexSeries } from '../../src/types/marketIndex'
import { readJson, writeJsonAtomic } from './io'
import { fetchKrxIndexDailyPayload } from './providers/krx-index'
import { fetchNasdaqHistoricalPayload } from './providers/nasdaq'

const OUTPUT_ROOT = 'public/data/indices'
const CACHE_ROOT = '.cache/market-index-data'
const DEFAULT_KRX_REQUEST_DELAY_MS = 100
const DEFAULT_KRX_CONCURRENCY = 2
const DEFAULT_NASDAQ_REQUEST_DELAY_MS = 100
const KRX_CARRY_IN_SCAN_DAYS = 10

interface KrxIndexDefinition {
  id: KrxMajorIndex
  alias: string
  market: 'KR'
  reference: string
}

interface NasdaqIndexDefinition {
  id: string
  alias: string
  market: 'US'
  symbol: string
  reference: string
}

type IndexDefinition = KrxIndexDefinition | NasdaqIndexDefinition

const KRX_DEFINITIONS: KrxIndexDefinition[] = [
  {
    id: 'KOSPI',
    alias: '코스피',
    market: 'KR',
    reference: 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp',
  },
  {
    id: 'KOSDAQ',
    alias: '코스닥',
    market: 'KR',
    reference: 'https://indices.krx.co.kr/contents/MKD/03/0301/03010000/MKD03010000T1.jsp',
  },
]

const NASDAQ_DEFINITIONS: NasdaqIndexDefinition[] = [
  {
    id: 'NASDAQ_COMPOSITE',
    alias: '나스닥 종합',
    market: 'US',
    symbol: 'COMP',
    reference: 'https://www.nasdaq.com/market-activity/index/comp/historical',
  },
]

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function midpoint(from: string, to: string): string {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  return new Date(start + Math.floor((end - start) / 2)).toISOString().slice(0, 10)
}

function envNonNegativeNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`)
  return parsed
}

function envPositiveInteger(name: string, fallback: number): number {
  const parsed = envNonNegativeNumber(name, fallback)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`)
  return parsed
}

function mergeBars(...groups: DailyBar[][]): DailyBar[] {
  const byDate = new Map<string, DailyBar>()
  for (const group of groups) {
    for (const bar of group) {
      const existing = byDate.get(bar.date)
      if (existing && JSON.stringify(existing) !== JSON.stringify(bar)) {
        throw new Error(`Conflicting market-index bars for ${bar.date}`)
      }
      byDate.set(bar.date, bar)
    }
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function carryInCandidateDates(firstTradingDate: string): string[] {
  return Array.from({ length: KRX_CARRY_IN_SCAN_DAYS }, (_, index) => addDays(firstTradingDate, -(index + 1))).reverse()
}

async function fetchKrxHistories(
  calendar: MarketCalendar,
  force: boolean,
  delayMs: number,
  concurrency: number,
): Promise<Map<KrxMajorIndex, DailyBar[]>> {
  const queryDates = [...carryInCandidateDates(calendar.tradingDates[0]), ...calendar.tradingDates]
  const daily = await mapWithConcurrency(queryDates, concurrency, async (date) => {
    const payload = await fetchKrxIndexDailyPayload({ date, cacheRoot: CACHE_ROOT, force, delayMs })
    return {
      kospi: normalizeKrxIndexDailyPayload(payload, { date, target: 'KOSPI' }),
      kosdaq: normalizeKrxIndexDailyPayload(payload, { date, target: 'KOSDAQ' }),
    }
  })

  return new Map<KrxMajorIndex, DailyBar[]>([
    ['KOSPI', daily.flatMap((item) => item.kospi ? [item.kospi] : [])],
    ['KOSDAQ', daily.flatMap((item) => item.kosdaq ? [item.kosdaq] : [])],
  ])
}

async function fetchNasdaqHistory(
  definition: NasdaqIndexDefinition,
  from: string,
  to: string,
  force: boolean,
  delayMs: number,
): Promise<DailyBar[]> {
  const payload = await fetchNasdaqHistoricalPayload({
    symbol: definition.symbol,
    assetClass: 'index',
    from,
    to,
    limit: 5000,
    cacheRoot: CACHE_ROOT,
    force,
    delayMs,
  })
  const bars = normalizeNasdaqHistoricalPayload(payload, { from, to })
  const totalRecords = nasdaqHistoricalTotalRecords(payload)
  if (totalRecords === null || totalRecords <= bars.length) return bars

  const pivot = midpoint(from, to)
  if (pivot <= from || pivot >= to) {
    throw new Error(`Nasdaq index pagination could not resolve ${definition.id}: ${bars.length}/${totalRecords}`)
  }
  const left = await fetchNasdaqHistory(definition, from, pivot, force, delayMs)
  const right = await fetchNasdaqHistory(definition, addDays(pivot, 1), to, force, delayMs)
  return mergeBars(left, right)
}

function assertCalendarCoverage(definition: IndexDefinition, bars: DailyBar[], calendar: MarketCalendar): void {
  if (bars.length < 3) throw new Error(`${definition.id} has insufficient historical rows`)
  const firstTradingDate = calendar.tradingDates[0]
  const carryInBars = bars.filter((bar) => bar.date < firstTradingDate)
  if (carryInBars.length < 2) {
    throw new Error(`${definition.id} requires two completed carry-in sessions before ${firstTradingDate}`)
  }

  const availableDates = new Set(bars.map((bar) => bar.date))
  const missingDates = calendar.tradingDates.filter((date) => date <= calendar.coverage.to && !availableDates.has(date))
  if (missingDates.length > 0) {
    throw new Error(`${definition.id} is missing ${missingDates.length} official trading dates; first missing=${missingDates[0]}`)
  }
}

async function loadCalendar(market: MarketCode): Promise<MarketCalendar> {
  return parseMarketCalendar(await readJson(join('public/data/calendars', market === 'KR' ? 'kr.json' : 'us.json')))
}

async function writeSeries(
  definition: IndexDefinition,
  bars: DailyBar[],
  generatedAt: string,
  manifest: MarketIndexManifest,
): Promise<void> {
  const dataPath = `${definition.market === 'KR' ? 'kr' : 'us'}/${definition.id}.json`
  const series: MarketIndexSeries = {
    schemaVersion: 1,
    id: definition.id,
    alias: definition.alias,
    market: definition.market,
    source: {
      authoritativeProvider: definition.market === 'KR' ? 'KRX Indices' : 'Nasdaq Historical Quotes',
      generatedAt,
      reference: definition.reference,
    },
    bars,
  }
  await writeJsonAtomic(join(OUTPUT_ROOT, dataPath), series)
  manifest.indices.push({ id: definition.id, alias: definition.alias, market: definition.market, dataPath })
  console.log(`${definition.id}: ${bars.length} rows (${bars[0].date}..${bars.at(-1)!.date})`)
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const krxDelayMs = envNonNegativeNumber('KRX_INDEX_REQUEST_DELAY_MS', DEFAULT_KRX_REQUEST_DELAY_MS)
  const krxConcurrency = envPositiveInteger('KRX_INDEX_CONCURRENCY', DEFAULT_KRX_CONCURRENCY)
  const nasdaqDelayMs = envNonNegativeNumber('NASDAQ_REQUEST_DELAY_MS', DEFAULT_NASDAQ_REQUEST_DELAY_MS)
  const calendars = { KR: await loadCalendar('KR'), US: await loadCalendar('US') }
  const generatedAt = new Date().toISOString()
  const manifest: MarketIndexManifest = { schemaVersion: 1, indices: [] }

  const krxHistories = await fetchKrxHistories(calendars.KR, force, krxDelayMs, krxConcurrency)
  for (const definition of KRX_DEFINITIONS) {
    const bars = krxHistories.get(definition.id) ?? []
    assertCalendarCoverage(definition, bars, calendars.KR)
    await writeSeries(definition, bars, generatedAt, manifest)
  }

  for (const definition of NASDAQ_DEFINITIONS) {
    const from = addDays(calendars.US.tradingDates[0], -7)
    const bars = await fetchNasdaqHistory(definition, from, calendars.US.coverage.to, force, nasdaqDelayMs)
    assertCalendarCoverage(definition, bars, calendars.US)
    await writeSeries(definition, bars, generatedAt, manifest)
  }

  await writeJsonAtomic(join(OUTPUT_ROOT, 'manifest.json'), manifest)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
