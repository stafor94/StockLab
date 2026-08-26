import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarketCalendar } from '../../src/data/schema'
import { parseMarketIndexManifest, parseMarketIndexSeries } from '../../src/data/marketIndexSchema'
import type { DailyBar, MarketCalendar, MarketCode } from '../../src/types/market'
import type { MarketIndexManifestItem } from '../../src/types/marketIndex'
import { readJson } from './io'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')
const INDEX_ROOT = join(DATA_ROOT, 'indices')

const EXPECTED_INDICES = [
  { id: 'KOSPI', alias: '코스피', market: 'KR', provider: 'KRX Data Marketplace' },
  { id: 'KOSDAQ', alias: '코스닥', market: 'KR', provider: 'KRX Data Marketplace' },
  { id: 'NASDAQ_COMPOSITE', alias: '나스닥 종합', market: 'US', provider: 'Nasdaq Historical Quotes' },
  { id: 'DOW_JONES', alias: '다우존스', market: 'US', provider: 'Nasdaq Historical Quotes' },
] as const

function validateBar(bar: DailyBar, id: string, market: MarketCode): void {
  if (![bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error(`${id} has non-positive/non-finite OHLC on ${bar.date}`)
  }
  if (bar.volume !== null && (!Number.isFinite(bar.volume) || bar.volume < 0)) {
    throw new Error(`${id} has invalid volume on ${bar.date}`)
  }
  if (market === 'KR') {
    if (bar.high < Math.max(bar.open, bar.close, bar.low)) throw new Error(`${id} has invalid high on ${bar.date}`)
    if (bar.low > Math.min(bar.open, bar.close, bar.high)) throw new Error(`${id} has invalid low on ${bar.date}`)
  }
}

function assertCoverage(
  item: MarketIndexManifestItem,
  bars: DailyBar[],
  calendar: MarketCalendar,
): void {
  if (bars.length < calendar.tradingDates.length + 2) {
    throw new Error(`${item.id} does not contain enough rows for calendar coverage plus carry-in sessions`)
  }
  const firstTradingDate = calendar.tradingDates[0]
  const carryIn = bars.filter((bar) => bar.date < firstTradingDate)
  if (carryIn.length < 2) {
    throw new Error(`${item.id} requires at least two completed carry-in sessions before ${firstTradingDate}`)
  }

  const barDates = new Set(bars.map((bar) => bar.date))
  const missing = calendar.tradingDates.filter((date) => date <= calendar.coverage.to && !barDates.has(date))
  if (missing.length > 0) {
    throw new Error(`${item.id} is missing ${missing.length} official trading dates; first missing=${missing[0]}`)
  }
  if (bars.at(-1)!.date < calendar.coverage.to) {
    throw new Error(`${item.id} ends before ${item.market} calendar coverage: ${bars.at(-1)!.date} < ${calendar.coverage.to}`)
  }
}

async function loadCalendar(market: MarketCode): Promise<MarketCalendar> {
  return parseMarketCalendar(await readJson(join(DATA_ROOT, 'calendars', market === 'KR' ? 'kr.json' : 'us.json')))
}

async function main(): Promise<void> {
  const manifest = parseMarketIndexManifest(await readJson(join(INDEX_ROOT, 'manifest.json')))
  if (manifest.indices.length !== EXPECTED_INDICES.length) {
    throw new Error(`market index manifest must contain ${EXPECTED_INDICES.length} indices; found ${manifest.indices.length}`)
  }

  const expectedById = new Map(EXPECTED_INDICES.map((item) => [item.id, item]))
  const calendars = { KR: await loadCalendar('KR'), US: await loadCalendar('US') }
  const seen = new Set<string>()

  for (const item of manifest.indices) {
    if (seen.has(item.id)) throw new Error(`duplicate market index ${item.id}`)
    seen.add(item.id)
    const expected = expectedById.get(item.id as (typeof EXPECTED_INDICES)[number]['id'])
    if (!expected) throw new Error(`unexpected market index ${item.id}`)
    if (item.alias !== expected.alias || item.market !== expected.market) {
      throw new Error(`${item.id} manifest metadata does not match the configured major index`)
    }

    const series = parseMarketIndexSeries(await readJson(join(INDEX_ROOT, item.dataPath)))
    if (series.id !== item.id || series.alias !== item.alias || series.market !== item.market) {
      throw new Error(`${item.id} series metadata does not match manifest metadata`)
    }
    if (series.source.authoritativeProvider !== expected.provider) {
      throw new Error(`${item.id} must use ${expected.provider}; found ${series.source.authoritativeProvider}`)
    }
    if (!series.source.reference.startsWith('https://')) {
      throw new Error(`${item.id} source reference must be HTTPS`)
    }

    let previousDate = ''
    for (const bar of series.bars) {
      if (bar.date <= previousDate) throw new Error(`${item.id} bars must be strictly ascending and unique`)
      validateBar(bar, item.id, item.market)
      previousDate = bar.date
    }
    assertCoverage(item, series.bars, calendars[item.market])
  }

  for (const expected of EXPECTED_INDICES) {
    if (!seen.has(expected.id)) throw new Error(`missing required market index ${expected.id}`)
  }

  console.log(`Validated ${manifest.indices.length} official major-index series with strict calendar coverage.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
