import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { parseCorporateEventDataset } from '../../src/data/corporateEventSchema'
import { classifySplitAdjustment } from '../../src/data/ingestion/unadjustSplitPrices'
import { parseAssetPriceSeries, parseMarketCalendar, parseMarketDataManifest } from '../../src/data/schema'
import type { DailyBar } from '../../src/types/market'
import { readJson } from './io'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')
const US_ASSETS = ASSET_CATALOG.filter((asset) => asset.market === 'US')
const KNOWN_US_CLOSURES = [
  '2018-01-15',
  '2018-03-30',
  '2018-07-04',
  '2018-11-22',
  '2018-12-25',
  '2020-01-01',
  '2020-07-03',
  '2020-12-25',
  '2021-12-24',
  '2022-06-20',
  '2023-11-23',
  '2024-07-04',
  '2025-01-20',
  '2025-12-25',
] as const

function validateBars(bars: DailyBar[], calendarDates: Set<string>, assetId: string): void {
  let previous = ''
  for (const bar of bars) {
    if (bar.date <= previous) throw new Error(`${assetId}: dates must be strictly ascending and unique`)
    if (!calendarDates.has(bar.date)) throw new Error(`${assetId}: ${bar.date} is not in calendars/us.json`)
    if (![bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error(`${assetId}: non-positive/non-finite OHLC on ${bar.date}`)
    }
    if (bar.volume !== null && (!Number.isFinite(bar.volume) || bar.volume < 0)) {
      throw new Error(`${assetId}: invalid volume on ${bar.date}`)
    }
    previous = bar.date
  }
}

async function main(): Promise<void> {
  if (US_ASSETS.length !== 57) throw new Error(`Catalog must contain 57 U.S. assets; found ${US_ASSETS.length}`)
  if (US_ASSETS.filter((asset) => asset.kind === 'stock').length !== 45) throw new Error('Catalog must contain 45 U.S. stocks')
  if (US_ASSETS.filter((asset) => asset.kind === 'etf').length !== 12) throw new Error('Catalog must contain 12 U.S. ETFs')

  const manifest = parseMarketDataManifest(await readJson(join(DATA_ROOT, 'manifest.json')))
  const calendar = parseMarketCalendar(await readJson(join(DATA_ROOT, manifest.calendars.US)))
  if (calendar.market !== 'US' || calendar.source.mode !== 'generated') throw new Error('U.S. calendar must be generated')
  if (calendar.source.authoritativeProvider !== 'Nasdaq Historical Quotes') {
    throw new Error('U.S. calendar authoritativeProvider must be Nasdaq Historical Quotes')
  }
  if (calendar.tradingDates.length === 0) throw new Error('U.S. calendar has no trading dates')
  const calendarDates = new Set(calendar.tradingDates)
  for (const closure of KNOWN_US_CLOSURES) {
    if (calendarDates.has(closure)) throw new Error(`Known U.S. market closure ${closure} appears as a trading day`)
  }

  const usManifest = manifest.assets.filter((asset) => asset.market === 'US')
  if (usManifest.length !== 57) throw new Error(`Strict U.S. coverage requires 57 assets; found ${usManifest.length}`)
  const manifestById = new Map(usManifest.map((item) => [item.id, item]))
  const corporate = parseCorporateEventDataset(await readJson(join(DATA_ROOT, 'events', 'corporate.json')))
  const splitEventsByAsset = new Map<string, typeof corporate.events>()
  for (const event of corporate.events) {
    if (event.type !== 'SPLIT' && event.type !== 'REVERSE_SPLIT') continue
    const bucket = splitEventsByAsset.get(event.assetId) ?? []
    bucket.push(event)
    splitEventsByAsset.set(event.assetId, bucket)
  }

  let totalBars = 0
  let unavailableVolumeBars = 0
  let earliest = '9999-12-31'
  let latest = '0000-01-01'
  let postStartListings = 0
  let splitAssets = 0
  let reverseSplitAssets = 0
  const firstTradingDate = calendar.tradingDates[0]
  const lastTradingDate = calendar.tradingDates.at(-1)!

  for (const asset of US_ASSETS) {
    const item = manifestById.get(asset.id)
    if (!item) throw new Error(`Missing U.S. manifest entry ${asset.id}`)
    if (item.dataPath !== asset.dataPath || item.alias !== asset.alias || item.kind !== asset.kind) {
      throw new Error(`${asset.id}: manifest metadata diverges from catalog`)
    }
    const series = parseAssetPriceSeries(await readJson(join(DATA_ROOT, item.dataPath)))
    if (series.id !== asset.id || series.market !== 'US' || series.kind !== asset.kind || series.currency !== 'USD') {
      throw new Error(`${asset.id}: price-series metadata mismatch`)
    }
    if (!series.source || series.source.authoritativeProvider !== 'Nasdaq Historical Quotes') {
      throw new Error(`${asset.id}: missing Nasdaq Historical Quotes source metadata`)
    }
    if (series.source.priceBasis !== 'historical-unadjusted') throw new Error(`${asset.id}: price basis is not unadjusted`)
    if (series.bars.length === 0) throw new Error(`${asset.id}: no bars`)
    if (series.bars[0].date !== item.listedFrom) throw new Error(`${asset.id}: listedFrom must equal first available Nasdaq bar`)
    if (series.bars.at(-1)!.date !== lastTradingDate) throw new Error(`${asset.id}: latest bar is not ${lastTradingDate}`)
    validateBars(series.bars, calendarDates, asset.id)
    unavailableVolumeBars += series.bars.filter((bar) => bar.volume === null).length

    const barDates = new Set(series.bars.map((bar) => bar.date))
    for (const date of calendar.tradingDates) {
      if (date < series.bars[0].date || date > series.bars.at(-1)!.date) continue
      if (!barDates.has(date)) throw new Error(`${asset.id}: missing Nasdaq trading date ${date}`)
    }

    const splitEvents = splitEventsByAsset.get(asset.id) ?? []
    if (splitEvents.length > 0) splitAssets += 1
    if (splitEvents.some((event) => event.type === 'REVERSE_SPLIT')) reverseSplitAssets += 1
    const splitDates = new Set(splitEvents.map((event) => event.date))
    for (const event of splitEvents) {
      if (event.type !== 'SPLIT' && event.type !== 'REVERSE_SPLIT') continue
      const state = classifySplitAdjustment(series.bars, {
        effectiveDate: event.date,
        numerator: event.payload.numerator,
        denominator: event.payload.denominator,
      })
      if (state !== 'unadjusted') {
        throw new Error(`${asset.id}: production prices around ${event.date} are still split-adjusted or ambiguous`)
      }
    }

    for (let index = 1; index < series.bars.length; index += 1) {
      const previous = series.bars[index - 1]
      const current = series.bars[index]
      if (splitDates.has(current.date)) continue
      const ratio = previous.close / current.open
      if (ratio > 1.75 || ratio < 0.57) {
        throw new Error(`${asset.id}: unexplained price-scale discontinuity ${previous.date} -> ${current.date}`)
      }
    }

    totalBars += series.bars.length
    if (series.bars[0].date < earliest) earliest = series.bars[0].date
    if (series.bars.at(-1)!.date > latest) latest = series.bars.at(-1)!.date
    if (series.bars[0].date > firstTradingDate) postStartListings += 1
  }

  console.log(JSON.stringify({
    stocks: 45,
    etfs: 12,
    assets: 57,
    totalBars,
    unavailableVolumeBars,
    earliest,
    latest,
    postStartListings,
    splitAssets,
    reverseSplitAssets,
    missingTradingDates: 0,
  }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
