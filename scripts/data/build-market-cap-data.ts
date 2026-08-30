import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { buildDailyMarketCapBar } from '../../src/data/ingestion/marketCapShares'
import { parseAssetPriceSeries, parseMarketDataManifest } from '../../src/data/schema'
import type {
  AssetManifestItem,
  AssetMarketCapitalizationSeries,
  AssetPriceSeries,
  DailyMarketCapitalizationBar,
  MarketDataManifest,
} from '../../src/types/market'
import { readJson, writeJsonAtomic } from './io'
import { fetchKrxKindListedShares } from './providers/krx-kind-listed-shares'
import { loadTrackedSecSharesSnapshots } from './sec-shares-snapshots'
import {
  loadKoreanMarketSourceMap,
  type KrxAssetSource,
  type KrxEndpoint,
} from './source-map'
import { VERIFIED_US_SPLIT_EVENTS, type VerifiedUsSplitEvent } from './us-split-events'
import { buildUsStockMarketCapSeries } from './us-stock-market-cap'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')
const CACHE_ROOT = join(ROOT, '.cache', 'market-data')
const DEFAULT_SOURCE_MAP_PATH = join(ROOT, 'config', 'market-source-map.json')
const DEFAULT_SEC_SNAPSHOT_ROOT = join(ROOT, 'config', 'sec-shares-snapshots')
const KRX_ENDPOINTS: KrxEndpoint[] = ['stk_bydd_trd', 'ksq_bydd_trd', 'etf_bydd_trd']

interface BuildOptions {
  sourceMapPath: string
  force: boolean
  krxDelayMs: number
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`)
  return value
}

function marketCapPath(asset: CatalogAsset): string {
  return `market-cap/${asset.market.toLowerCase()}/${asset.id}.json`
}

function supportsMarketCap(asset: CatalogAsset): boolean {
  return asset.market === 'KR' || (asset.market === 'US' && asset.kind === 'stock')
}

function splitEventsFor(assetId: string): VerifiedUsSplitEvent[] {
  return VERIFIED_US_SPLIT_EVENTS.filter((event) => event.assetId === assetId)
}

function normalizeIdentityName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
}

function assertKrxIdentity(asset: CatalogAsset, source: KrxAssetSource, actualName: string): void {
  if (!source.expectedName) return
  if (normalizeIdentityName(source.expectedName) !== normalizeIdentityName(actualName)) {
    throw new Error(`${asset.id} KRX KIND security identity does not match the private expected name`)
  }
}

async function loadPrices(manifest: MarketDataManifest): Promise<Map<string, AssetPriceSeries>> {
  if (manifest.assets.length !== ASSET_CATALOG.length) {
    throw new Error(`Market-cap build requires the complete ${ASSET_CATALOG.length}-asset price manifest`)
  }
  const result = new Map<string, AssetPriceSeries>()
  for (const item of manifest.assets) {
    const series = parseAssetPriceSeries(await readJson(join(DATA_ROOT, item.dataPath)))
    if (series.id !== item.id || series.market !== item.market || series.currency !== item.currency || series.bars.length === 0) {
      throw new Error(`${item.id} price series does not match manifest metadata`)
    }
    result.set(item.id, series)
  }
  return result
}

async function buildKorean(
  assets: CatalogAsset[],
  prices: Map<string, AssetPriceSeries>,
  sources: Map<string, KrxAssetSource>,
  options: BuildOptions,
  generatedAt: string,
): Promise<Map<string, AssetMarketCapitalizationSeries>> {
  const capBars = new Map(assets.map((asset) => [asset.id, [] as DailyMarketCapitalizationBar[]]))
  const barsByDate = new Map(assets.map((asset) => [asset.id, new Map(prices.get(asset.id)!.bars.map((bar) => [bar.date, bar]))]))
  const tradingDates = [...new Set(assets.flatMap((asset) => prices.get(asset.id)!.bars.map((bar) => bar.date)))].sort()

  for (const [dateIndex, date] of tradingDates.entries()) {
    if (dateIndex % 100 === 0) console.log(`KRX KIND listed shares ${dateIndex + 1}/${tradingDates.length}: ${date}`)
    const active = assets.filter((asset) => barsByDate.get(asset.id)!.has(date))
    const expectedSecurities = active.map((asset) => {
      const source = sources.get(asset.id)!
      return { symbol: source.symbol, isin: source.isin, expectedName: source.expectedName }
    })
    const rowsByEndpoint = await Promise.all(KRX_ENDPOINTS.map((endpoint) => fetchKrxKindListedShares({
      endpoint,
      date,
      expectedSecurities,
      cacheRoot: CACHE_ROOT,
      force: options.force,
      delayMs: options.krxDelayMs,
    })))
    const rowsBySymbol = new Map<string, Array<(typeof rowsByEndpoint)[number][number]>>()
    for (const rows of rowsByEndpoint) {
      for (const row of rows) {
        const existing = rowsBySymbol.get(row.symbol) ?? []
        existing.push(row)
        rowsBySymbol.set(row.symbol, existing)
      }
    }
    for (const asset of active) {
      const source = sources.get(asset.id)!
      const rows = rowsBySymbol.get(source.symbol) ?? []
      if (rows.length !== 1) {
        throw new Error(`${asset.id}: KRX KIND did not resolve exactly one security-level listed-share row on ${date}`)
      }
      const row = rows[0]
      if (source.isin && row.securityCode.toUpperCase() !== source.isin.toUpperCase()) {
        throw new Error(`${asset.id}: KRX KIND returned a different security code than the private ISIN on ${date}`)
      }
      assertKrxIdentity(asset, source, row.name)
      const price = barsByDate.get(asset.id)!.get(date)!
      const assetCapBars = capBars.get(asset.id)!
      assetCapBars.push(buildDailyMarketCapBar(price, row.listedShares, assetCapBars.at(-1)?.close ?? null))
    }
  }

  return new Map(assets.map((asset) => [asset.id, {
    schemaVersion: 1,
    id: asset.id,
    market: 'KR' as const,
    currency: 'KRW' as const,
    source: {
      authoritativeProvider: 'KRX KIND',
      methodology: 'Existing unadjusted KRX KIND price × KRX KIND security-level historical listed shares (reported in thousands of shares); the active KOSPI/KOSDAQ/ETF table is resolved from the official security row on each trading date and current-session close is never exposed before close.',
      generatedAt,
    },
    bars: capBars.get(asset.id)!,
  }]))
}

async function buildUsStocks(
  assets: CatalogAsset[],
  prices: Map<string, AssetPriceSeries>,
  generatedAt: string,
): Promise<Map<string, AssetMarketCapitalizationSeries>> {
  const result = new Map<string, AssetMarketCapitalizationSeries>()
  for (const [index, asset] of assets.entries()) {
    console.log(`Tracked SEC shares ${index + 1}/${assets.length}: ${asset.id}`)
    const snapshots = await loadTrackedSecSharesSnapshots(DEFAULT_SEC_SNAPSHOT_ROOT, asset.id)
    const series = buildUsStockMarketCapSeries(
      asset.id,
      prices.get(asset.id)!,
      snapshots,
      splitEventsFor(asset.id),
      generatedAt,
    )
    result.set(asset.id, series)
  }
  return result
}

async function main(): Promise<void> {
  const options: BuildOptions = {
    sourceMapPath: process.env.MARKET_SOURCE_MAP_PATH ?? DEFAULT_SOURCE_MAP_PATH,
    force: process.argv.includes('--force'),
    krxDelayMs: envNumber('KRX_KIND_REQUEST_DELAY_MS', 120),
  }
  const manifest = parseMarketDataManifest(await readJson(join(DATA_ROOT, 'manifest.json')))
  const prices = await loadPrices(manifest)
  const krAssets = ASSET_CATALOG.filter((asset) => asset.market === 'KR')
  const usStocks = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'stock')
  const supportedAssets = ASSET_CATALOG.filter(supportsMarketCap)
  const krSources = await loadKoreanMarketSourceMap(options.sourceMapPath)
  for (const asset of krAssets) {
    if (!krSources.has(asset.id)) throw new Error(`${asset.id}: missing KRX private mapping`)
  }

  const generatedAt = new Date().toISOString()
  const stocks = await buildUsStocks(usStocks, prices, generatedAt)
  const korean = await buildKorean(krAssets, prices, krSources, options, generatedAt)
  const all = new Map<string, AssetMarketCapitalizationSeries>([...korean, ...stocks])
  if (all.size !== supportedAssets.length) {
    throw new Error(`Expected ${supportedAssets.length} supported market-cap series; built ${all.size}`)
  }

  for (const asset of supportedAssets) {
    const series = all.get(asset.id)!
    if (series.bars.length !== prices.get(asset.id)!.bars.length) throw new Error(`${asset.id}: market-cap and price lengths differ`)
    await writeJsonAtomic(join(DATA_ROOT, marketCapPath(asset)), series)
  }

  const supportedIds = new Set(supportedAssets.map((asset) => asset.id))
  const currentById = new Map(manifest.assets.map((item) => [item.id, item]))
  const assets: AssetManifestItem[] = ASSET_CATALOG.map((asset) => {
    const item = currentById.get(asset.id)
    if (!item) throw new Error(`Manifest is missing ${asset.id}`)
    return supportedIds.has(asset.id)
      ? { ...item, marketCapPath: marketCapPath(asset) }
      : { ...item, marketCapPath: undefined }
  })
  await writeJsonAtomic(join(DATA_ROOT, 'manifest.json'), { ...manifest, assets } satisfies MarketDataManifest)
  console.log(`Historical market-cap build complete for ${all.size} supported assets; ${ASSET_CATALOG.length - all.size} U.S. ETFs remain intentionally unavailable.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
