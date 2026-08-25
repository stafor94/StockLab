import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import {
  parseAssetPriceSeries,
  parseMarketCalendar,
  parseMarketDataManifest,
} from '../../src/data/schema'
import type { DailyBar, MarketCode } from '../../src/types/market'
import { readJson } from './io'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')

function validateCatalog(): void {
  if (ASSET_CATALOG.length !== 109) {
    throw new Error(`asset catalog must contain 109 assets; found ${ASSET_CATALOG.length}`)
  }
  const ids = new Set<string>()
  const paths = new Set<string>()
  for (const asset of ASSET_CATALOG) {
    if (ids.has(asset.id)) throw new Error(`duplicate asset id ${asset.id}`)
    if (paths.has(asset.dataPath)) throw new Error(`duplicate asset dataPath ${asset.dataPath}`)
    ids.add(asset.id)
    paths.add(asset.dataPath)
  }
}

function validateBars(bars: DailyBar[], calendarDates: Set<string>, assetId: string): void {
  let previous = ''
  for (const bar of bars) {
    if (bar.date <= previous) throw new Error(`${assetId} bars must be strictly ascending and unique`)
    if (!calendarDates.has(bar.date)) throw new Error(`${assetId} contains ${bar.date}, absent from its market calendar`)
    if (![bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error(`${assetId} has non-positive/non-finite OHLC on ${bar.date}`)
    }
    if (!Number.isFinite(bar.volume) || bar.volume < 0) throw new Error(`${assetId} has invalid volume on ${bar.date}`)
    if (bar.high < Math.max(bar.open, bar.close, bar.low)) throw new Error(`${assetId} has an invalid high on ${bar.date}`)
    if (bar.low > Math.min(bar.open, bar.close, bar.high)) throw new Error(`${assetId} has an invalid low on ${bar.date}`)
    previous = bar.date
  }
}

async function main(): Promise<void> {
  validateCatalog()
  const allowBootstrap = process.argv.includes('--allow-bootstrap')
  const manifest = parseMarketDataManifest(await readJson(join(DATA_ROOT, 'manifest.json')))
  const calendars = {
    KR: parseMarketCalendar(await readJson(join(DATA_ROOT, manifest.calendars.KR))),
    US: parseMarketCalendar(await readJson(join(DATA_ROOT, manifest.calendars.US))),
  }

  if (manifest.assets.length === 0) {
    if (!allowBootstrap) throw new Error('manifest contains no generated assets; run a market-data builder first')
    console.log('Bootstrap manifest validated; authoritative price files have not been generated yet.')
    return
  }

  if (!allowBootstrap && manifest.assets.length !== ASSET_CATALOG.length) {
    throw new Error(`generated manifest must contain ${ASSET_CATALOG.length} assets`)
  }

  const catalogById = new Map(ASSET_CATALOG.map((asset) => [asset.id, asset]))
  const calendarSets: Record<MarketCode, Set<string>> = {
    KR: new Set(calendars.KR.tradingDates),
    US: new Set(calendars.US.tradingDates),
  }
  const manifestIds = new Set<string>()

  for (const item of manifest.assets) {
    if (manifestIds.has(item.id)) throw new Error(`manifest contains duplicate asset ${item.id}`)
    manifestIds.add(item.id)
    const catalog = catalogById.get(item.id)
    if (!catalog) throw new Error(`manifest contains unknown asset ${item.id}`)
    if (
      item.alias !== catalog.alias
      || item.market !== catalog.market
      || item.kind !== catalog.kind
      || item.currency !== catalog.currency
      || item.sector !== catalog.sector
      || item.dataPath !== catalog.dataPath
    ) throw new Error(`${item.id} manifest metadata diverges from the masked asset catalog`)

    const series = parseAssetPriceSeries(await readJson(join(DATA_ROOT, item.dataPath)))
    if (
      series.id !== item.id
      || series.market !== item.market
      || series.kind !== item.kind
      || series.currency !== item.currency
    ) throw new Error(`${item.id} price-series metadata does not match manifest metadata`)
    if (series.bars.length === 0) throw new Error(`${item.id} has no daily bars`)
    if (series.bars[0].date < item.listedFrom) throw new Error(`${item.id} contains bars before its listedFrom date`)
    validateBars(series.bars, calendarSets[item.market], item.id)
  }

  for (const market of ['KR', 'US'] as const) {
    const expected = ASSET_CATALOG.filter((asset) => asset.market === market)
    const present = expected.filter((asset) => manifestIds.has(asset.id))
    if (calendars[market].source.mode === 'generated' && present.length !== expected.length) {
      throw new Error(`${market} generated calendar requires full market coverage ${present.length}/${expected.length}`)
    }
    if (!allowBootstrap && calendars[market].source.mode !== 'generated') {
      throw new Error(`${market} calendar must be generated in strict mode`)
    }
  }

  console.log(`Validated ${manifest.assets.length} generated asset series with per-market bootstrap support.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
