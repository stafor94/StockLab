import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import {
  parseAssetPriceSeries,
  parseMarketCalendar,
  parseMarketDataManifest,
} from '../../src/data/schema'
import type { DailyBar } from '../../src/types/market'
import { readJson } from './io'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')
const KR_ASSETS = ASSET_CATALOG.filter((asset) => asset.market === 'KR')
const REQUIRED_FROM = '2018-01-01'

function assertBars(bars: DailyBar[], calendarDates: Set<string>, id: string): void {
  if (bars.length === 0) throw new Error(`${id} has no daily bars`)
  let previous = ''
  for (const bar of bars) {
    if (bar.date <= previous) throw new Error(`${id} bars must be strictly ascending and unique`)
    if (!calendarDates.has(bar.date)) throw new Error(`${id} bar ${bar.date} is absent from the KR calendar`)
    if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0 || bar.volume < 0) {
      throw new Error(`${id} has invalid OHLCV on ${bar.date}`)
    }
    if (bar.high < Math.max(bar.open, bar.close, bar.low)) {
      throw new Error(`${id} has invalid high on ${bar.date}`)
    }
    if (bar.low > Math.min(bar.open, bar.close, bar.high)) {
      throw new Error(`${id} has invalid low on ${bar.date}`)
    }
    previous = bar.date
  }
}

function assertK001RawSplitRegression(bars: DailyBar[]): void {
  const byDate = new Map(bars.map((bar) => [bar.date, bar]))
  const before = byDate.get('2018-04-27')
  const after = byDate.get('2018-05-04')
  if (!before || !after) {
    throw new Error('K001 is missing the 2018-04-27/2018-05-04 split regression dates')
  }

  const expectedBefore: DailyBar = {
    date: '2018-04-27',
    open: 2669000,
    high: 2682000,
    low: 2622000,
    close: 2650000,
    volume: 606216,
  }
  const expectedAfter: DailyBar = {
    date: '2018-05-04',
    open: 53000,
    high: 53900,
    low: 51800,
    close: 51900,
    volume: 39565391,
  }
  if (JSON.stringify(before) !== JSON.stringify(expectedBefore)) {
    throw new Error(`K001 raw pre-split regression changed: ${JSON.stringify(before)}`)
  }
  if (JSON.stringify(after) !== JSON.stringify(expectedAfter)) {
    throw new Error(`K001 raw post-split regression changed: ${JSON.stringify(after)}`)
  }
}

async function main(): Promise<void> {
  const manifest = parseMarketDataManifest(await readJson(join(DATA_ROOT, 'manifest.json')))
  const krCalendar = parseMarketCalendar(await readJson(join(DATA_ROOT, manifest.calendars.KR)))
  const calendarDates = new Set(krCalendar.tradingDates)

  if (krCalendar.market !== 'KR' || krCalendar.source.authoritativeProvider !== 'KRX KIND') {
    throw new Error('KR calendar must be generated from KRX KIND')
  }
  if (krCalendar.coverage.from !== REQUIRED_FROM) {
    throw new Error(`KR calendar coverage must start at ${REQUIRED_FROM}`)
  }

  const krItems = manifest.assets.filter((asset) => asset.market === 'KR')
  if (krItems.length !== KR_ASSETS.length) {
    throw new Error(`KR manifest must contain ${KR_ASSETS.length} assets; found ${krItems.length}`)
  }

  const itemById = new Map(krItems.map((item) => [item.id, item]))
  let k001Bars: DailyBar[] | null = null
  for (const catalog of KR_ASSETS) {
    const item = itemById.get(catalog.id)
    if (!item) throw new Error(`KR manifest is missing ${catalog.id}`)
    if (
      item.alias !== catalog.alias
      || item.kind !== catalog.kind
      || item.currency !== 'KRW'
      || item.sector !== catalog.sector
      || item.dataPath !== catalog.dataPath
    ) {
      throw new Error(`${catalog.id} manifest metadata diverges from the masked catalog`)
    }

    const series = parseAssetPriceSeries(await readJson(join(DATA_ROOT, item.dataPath)))
    if (series.id !== item.id || series.market !== 'KR' || series.kind !== item.kind || series.currency !== 'KRW') {
      throw new Error(`${item.id} series metadata does not match its manifest entry`)
    }
    assertBars(series.bars, calendarDates, item.id)
    if (item.id === 'K001') k001Bars = series.bars
  }

  if (!k001Bars) throw new Error('K001 series was not validated')
  assertK001RawSplitRegression(k001Bars)
  console.log(`Validated all ${KR_ASSETS.length} Korean KRX KIND series with raw-price regression coverage.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
