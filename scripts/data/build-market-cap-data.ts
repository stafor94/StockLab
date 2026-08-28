import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { alignSharesToPriceDate } from '../../src/data/ingestion/marketCapShares'
import {
  normalizeSecSharesOutstandingCompanyFacts,
  selectSecSharesAvailableBefore,
  type SecSharesOutstandingSnapshot,
} from '../../src/data/ingestion/secSharesOutstanding'
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
import { fetchSecCompanyFacts, fetchSecCompanyTickers, resolveSecCikForTicker } from './providers/sec-edgar'
import {
  getKrxEndpointForDate,
  loadMarketSourceMap,
  type KrxAssetSource,
  type KrxEndpoint,
  type NasdaqAssetSource,
} from './source-map'
import { VERIFIED_US_SPLIT_EVENTS, type VerifiedUsSplitEvent } from './us-split-events'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')
const CACHE_ROOT = join(ROOT, '.cache', 'market-data')
const DEFAULT_SOURCE_MAP_PATH = join(ROOT, '.private', 'market-source-map.json')
const DEFAULT_SEC_USER_AGENT = 'StockLab market-cap builder (+https://github.com/stafor94/StockLab)'
const KRX_ENDPOINTS: KrxEndpoint[] = ['stk_bydd_trd', 'ksq_bydd_trd', 'etf_bydd_trd']
const MAX_UNEXPLAINED_SEC_SHARE_FACTOR = 100

interface BuildOptions {
  sourceMapPath: string
  secUserAgent: string
  force: boolean
  krxDelayMs: number
  secDelayMs: number
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

function cap(price: number, shares: number): number {
  const value = price * shares
  if (!Number.isFinite(value) || value <= 0) throw new Error('market-cap calculation produced an invalid value')
  return value
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

function assertSecShareHistoryPlausible(
  assetId: string,
  snapshots: readonly SecSharesOutstandingSnapshot[],
  splits: readonly VerifiedUsSplitEvent[],
): void {
  const ordered = [...snapshots].sort((left, right) =>
    left.asOfDate.localeCompare(right.asOfDate) || left.availableFrom.localeCompare(right.availableFrom),
  )
  let previous: SecSharesOutstandingSnapshot | null = null
  for (const current of ordered) {
    if (!previous) {
      previous = current
      continue
    }
    const priorShares = alignSharesToPriceDate(
      previous.sharesOutstanding,
      previous.asOfDate,
      current.asOfDate,
      splits,
    )
    const factor = current.sharesOutstanding / priorShares
    if (!Number.isFinite(factor) || factor <= 0 || factor > MAX_UNEXPLAINED_SEC_SHARE_FACTOR || factor < 1 / MAX_UNEXPLAINED_SEC_SHARE_FACTOR) {
      throw new Error(`${assetId}: SEC shares outstanding changed by an implausible factor near ${current.asOfDate}; inspect the filing facts before publishing`)
    }
    previous = current
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
    await Promise.all(KRX_ENDPOINTS.map(async (endpoint) => {
      const matching = assets.filter((asset) => barsByDate.get(asset.id)!.has(date) && getKrxEndpointForDate(sources.get(asset.id)!, date) === endpoint)
      if (matching.length === 0) return
      const expectedSecurities = matching.map((asset) => {
        const source = sources.get(asset.id)!
        return { symbol: source.symbol, isin: source.isin, expectedName: source.expectedName }
      })
      const rows = await fetchKrxKindListedShares({
        endpoint,
        date,
        expectedSecurities,
        cacheRoot: CACHE_ROOT,
        force: options.force,
        delayMs: options.krxDelayMs,
      })
      const rowBySymbol = new Map(rows.map((row) => [row.symbol, row]))
      for (const asset of matching) {
        const source = sources.get(asset.id)!
        const row = rowBySymbol.get(source.symbol)
        if (!row) throw new Error(`${asset.id}: KRX KIND did not return the mapped security-level listed shares on ${date}`)
        if (source.isin && row.securityCode.toUpperCase() !== source.isin.toUpperCase()) {
          throw new Error(`${asset.id}: KRX KIND returned a different security code than the private ISIN on ${date}`)
        }
        assertKrxIdentity(asset, source, row.name)
        const price = barsByDate.get(asset.id)!.get(date)!
        const prior = capBars.get(asset.id)!.at(-1)
        capBars.get(asset.id)!.push({
          date,
          preopen: prior?.close ?? null,
          open: cap(price.open, row.listedShares),
          close: cap(price.close, row.listedShares),
        })
      }
    }))
  }

  return new Map(assets.map((asset) => [asset.id, {
    schemaVersion: 1,
    id: asset.id,
    market: 'KR' as const,
    currency: 'KRW' as const,
    source: {
      authoritativeProvider: 'KRX KIND',
      methodology: 'Existing unadjusted KRX KIND price × KRX KIND security-level historical listed shares (reported in thousands of shares); private ISIN/name identity checks prevent share-class collisions and current-session close is never exposed before close.',
      generatedAt,
    },
    bars: capBars.get(asset.id)!,
  }]))
}

async function buildUsStocks(
  assets: CatalogAsset[],
  prices: Map<string, AssetPriceSeries>,
  sources: Map<string, NasdaqAssetSource>,
  options: BuildOptions,
  generatedAt: string,
): Promise<Map<string, AssetMarketCapitalizationSeries>> {
  const tickerPayload = await fetchSecCompanyTickers({
    cacheRoot: CACHE_ROOT,
    force: options.force,
    delayMs: options.secDelayMs,
    userAgent: options.secUserAgent,
  })
  const result = new Map<string, AssetMarketCapitalizationSeries>()

  for (const [index, asset] of assets.entries()) {
    console.log(`SEC shares ${index + 1}/${assets.length}: ${asset.id}`)
    const source = sources.get(asset.id)!
    const cik = resolveSecCikForTicker(tickerPayload, source.symbol)
    const facts = await fetchSecCompanyFacts(cik, {
      cacheRoot: CACHE_ROOT,
      force: options.force,
      delayMs: options.secDelayMs,
      userAgent: options.secUserAgent,
    })
    const snapshots = normalizeSecSharesOutstandingCompanyFacts(facts)
    if (snapshots.length === 0) throw new Error(`${asset.id}: SEC EDGAR has no usable shares-outstanding facts`)
    const priceBars = prices.get(asset.id)!.bars
    const splits = splitEventsFor(asset.id)
    assertSecShareHistoryPlausible(asset.id, snapshots, splits)
    const bars = priceBars.map((bar, barIndex): DailyMarketCapitalizationBar => {
      const snapshot = selectSecSharesAvailableBefore(snapshots, bar.date)
      if (!snapshot) return { date: bar.date, preopen: null, open: null, close: null }
      const shares = alignSharesToPriceDate(snapshot.sharesOutstanding, snapshot.asOfDate, bar.date, splits)
      const previousPrice = barIndex > 0 ? priceBars[barIndex - 1] : null
      const previousShares = previousPrice
        ? alignSharesToPriceDate(snapshot.sharesOutstanding, snapshot.asOfDate, previousPrice.date, splits)
        : null
      return {
        date: bar.date,
        preopen: previousPrice && previousShares ? cap(previousPrice.close, previousShares) : null,
        open: cap(bar.open, shares),
        close: cap(bar.close, shares),
      }
    })
    result.set(asset.id, {
      schemaVersion: 1,
      id: asset.id,
      market: 'US',
      currency: 'USD',
      source: {
        authoritativeProvider: 'Nasdaq Historical Quotes + SEC EDGAR',
        methodology: 'Existing unadjusted Nasdaq price × latest issuer-level common shares outstanding publicly filed before the trading date; SEC cover-page class facts are aggregated per filing, with period-end GAAP shares used only when cover facts are unavailable, and verified split ratios align share and price dates.',
        generatedAt,
      },
      bars,
    })
  }
  return result
}

async function main(): Promise<void> {
  const options: BuildOptions = {
    sourceMapPath: process.env.MARKET_SOURCE_MAP_PATH ?? DEFAULT_SOURCE_MAP_PATH,
    secUserAgent: process.env.SEC_USER_AGENT?.trim() || DEFAULT_SEC_USER_AGENT,
    force: process.argv.includes('--force'),
    krxDelayMs: envNumber('KRX_KIND_REQUEST_DELAY_MS', 120),
    secDelayMs: envNumber('SEC_REQUEST_DELAY_MS', 120),
  }
  const manifest = parseMarketDataManifest(await readJson(join(DATA_ROOT, 'manifest.json')))
  const prices = await loadPrices(manifest)
  const sourceMap = await loadMarketSourceMap(options.sourceMapPath, false)
  const krAssets = ASSET_CATALOG.filter((asset) => asset.market === 'KR')
  const usStocks = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'stock')
  const supportedAssets = ASSET_CATALOG.filter(supportsMarketCap)
  const krSources = new Map<string, KrxAssetSource>()
  const usSources = new Map<string, NasdaqAssetSource>()

  for (const asset of krAssets) {
    const source = sourceMap.assets.get(asset.id)
    if (!source || source.provider !== 'KRX') throw new Error(`${asset.id}: missing KRX private mapping`)
    krSources.set(asset.id, source)
  }
  for (const asset of usStocks) {
    const source = sourceMap.assets.get(asset.id)
    if (!source || source.provider !== 'NASDAQ') throw new Error(`${asset.id}: missing Nasdaq private mapping`)
    usSources.set(asset.id, source)
  }

  const generatedAt = new Date().toISOString()
  const korean = await buildKorean(krAssets, prices, krSources, options, generatedAt)
  const stocks = await buildUsStocks(usStocks, prices, usSources, options, generatedAt)
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