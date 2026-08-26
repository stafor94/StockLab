import { join } from 'node:path'
import { normalizeKrxIndexPayload } from '../../src/data/ingestion/krxIndex'
import { nasdaqHistoricalTotalRecords, normalizeNasdaqHistoricalPayload } from '../../src/data/ingestion/nasdaqHistorical'
import { parseMarketCalendar } from '../../src/data/schema'
import type { DailyBar, MarketCalendar, MarketCode } from '../../src/types/market'
import type { MarketIndexManifest, MarketIndexSeries } from '../../src/types/marketIndex'
import { readJson, writeJsonAtomic } from './io'
import { fetchKrxIndexHistoricalPayload, type KrxIndexEndpoint } from './providers/krx-index'
import { fetchNasdaqHistoricalPayload } from './providers/nasdaq'

const OUTPUT_ROOT = 'public/data/indices'
const CACHE_ROOT = '.cache/market-index-data'
const DEFAULT_KRX_REQUEST_DELAY_MS = 40
const DEFAULT_NASDAQ_REQUEST_DELAY_MS = 100

interface KrxIndexDefinition {
  id: string
  alias: string
  market: 'KR'
  endpoint: KrxIndexEndpoint
  indexName: string
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

const INDEX_DEFINITIONS: IndexDefinition[] = [
  {
    id: 'KOSPI',
    alias: '코스피',
    market: 'KR',
    endpoint: 'kospi_dd_trd',
    indexName: '코스피',
    reference: 'https://openapi.krx.co.kr/',
  },
  {
    id: 'KOSDAQ',
    alias: '코스닥',
    market: 'KR',
    endpoint: 'kosdaq_dd_trd',
    indexName: '코스닥',
    reference: 'https://openapi.krx.co.kr/',
  },
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

function envDelay(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`)
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

async function fetchKrxDate(
  definition: KrxIndexDefinition,
  date: string,
  authKey: string,
  force: boolean,
  delayMs: number,
): Promise<DailyBar[]> {
  const payload = await fetchKrxIndexHistoricalPayload({
    endpoint: definition.endpoint,
    date,
    authKey,
    cacheRoot: CACHE_ROOT,
    force,
    delayMs,
  })
  const bars = normalizeKrxIndexPayload(payload, definition.indexName)
  if (bars.length > 1) throw new Error(`${definition.id} returned multiple representative rows for ${date}`)
  return bars
}

async function fetchKrxCarryIn(
  definition: KrxIndexDefinition,
  firstTradingDate: string,
  authKey: string,
  force: boolean,
  delayMs: number,
): Promise<DailyBar[]> {
  const carryIn: DailyBar[] = []
  let date = addDays(firstTradingDate, -1)
  for (let attempts = 0; attempts < 14 && carryIn.length < 2; attempts += 1) {
    const bars = await fetchKrxDate(definition, date, authKey, force, delayMs)
    if (bars.length === 1) carryIn.push(bars[0])
    date = addDays(date, -1)
  }
  if (carryIn.length < 2) {
    throw new Error(`${definition.id} could not load two official carry-in sessions before ${firstTradingDate}`)
  }
  return carryIn.sort((left, right) => left.date.localeCompare(right.date))
}

async function fetchKrxHistory(
  definition: KrxIndexDefinition,
  calendar: MarketCalendar,
  authKey: string,
  force: boolean,
  delayMs: number,
): Promise<DailyBar[]> {
  const firstTradingDate = calendar.tradingDates[0]
  const groups: DailyBar[][] = [await fetchKrxCarryIn(definition, firstTradingDate, authKey, force, delayMs)]
  for (const date of calendar.tradingDates) {
    const bars = await fetchKrxDate(definition, date, authKey, force, delayMs)
    if (bars.length !== 1) throw new Error(`${definition.id} has no official representative row for trading date ${date}`)
    groups.push(bars)
  }
  return mergeBars(...groups)
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

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const krxAuthKey = process.env.KRX_AUTH_KEY?.trim() ?? ''
  if (!krxAuthKey) throw new Error('KRX_AUTH_KEY is required to build official KOSPI/KOSDAQ index history')
  const krxDelayMs = envDelay('KRX_INDEX_REQUEST_DELAY_MS', DEFAULT_KRX_REQUEST_DELAY_MS)
  const nasdaqDelayMs = envDelay('NASDAQ_REQUEST_DELAY_MS', DEFAULT_NASDAQ_REQUEST_DELAY_MS)
  const calendars = {
    KR: await loadCalendar('KR'),
    US: await loadCalendar('US'),
  }
  const generatedAt = new Date().toISOString()
  const manifest: MarketIndexManifest = { schemaVersion: 1, indices: [] }

  for (const definition of INDEX_DEFINITIONS) {
    const calendar = calendars[definition.market]
    const bars = definition.market === 'KR'
      ? await fetchKrxHistory(definition, calendar, krxAuthKey, force, krxDelayMs)
      : await fetchNasdaqHistory(definition, addDays(calendar.tradingDates[0], -7), calendar.coverage.to, force, nasdaqDelayMs)

    assertCalendarCoverage(definition, bars, calendar)
    const dataPath = `${definition.market === 'KR' ? 'kr' : 'us'}/${definition.id}.json`
    const series: MarketIndexSeries = {
      schemaVersion: 1,
      id: definition.id,
      alias: definition.alias,
      market: definition.market,
      source: {
        authoritativeProvider: definition.market === 'KR' ? 'KRX Data Marketplace' : 'Nasdaq Historical Quotes',
        generatedAt,
        reference: definition.reference,
      },
      bars,
    }
    await writeJsonAtomic(join(OUTPUT_ROOT, dataPath), series)
    manifest.indices.push({
      id: definition.id,
      alias: definition.alias,
      market: definition.market,
      dataPath,
    })
    console.log(`${definition.id}: ${bars.length} rows (${bars[0].date}..${bars.at(-1)!.date})`)
  }

  await writeJsonAtomic(join(OUTPUT_ROOT, 'manifest.json'), manifest)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
