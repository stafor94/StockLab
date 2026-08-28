import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { alignSharesToPriceDate } from '../../src/data/ingestion/marketCapShares'
import { parseNormalizedNasdaqGidsSharesCsv, type NasdaqGidsSharesRow } from '../../src/data/ingestion/nasdaqGidsShares'
import { normalizeSecSharesOutstandingCompanyFacts, selectSecSharesAvailableBefore } from '../../src/data/ingestion/secSharesOutstanding'
import { parseAssetPriceSeries, parseMarketDataManifest } from '../../src/data/schema'
import type {
  AssetManifestItem,
  AssetMarketCapitalizationSeries,
  AssetPriceSeries,
  DailyMarketCapitalizationBar,
  MarketDataManifest,
} from '../../src/types/market'
import { pathExists, readJson, writeJsonAtomic } from './io'
import { fetchKrxOpenApiMarketCapRows } from './providers/krx-openapi'
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
const DEFAULT_GIDS_PATH = join(ROOT, '.private', 'nasdaq-gids-etf-tso.csv')
const KRX_ENDPOINTS: KrxEndpoint[] = ['stk_bydd_trd', 'ksq_bydd_trd', 'etf_bydd_trd']

interface BuildOptions {
  sourceMapPath: string
  gidsPath: string
  krxAuthKey: string
  secUserAgent: string
  force: boolean
  krxDelayMs: number
  secDelayMs: number
}

function envRequired(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
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
    throw new Error(`${asset.id} KRX OPEN API identity does not match the private expected name`)
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
    if (dateIndex % 100 === 0) console.log(`KRX market-cap ${dateIndex + 1}/${tradingDates.length}: ${date}`)
    for (const endpoint of KRX_ENDPOINTS) {
      const matching = assets.filter((asset) => barsByDate.get(asset.id)!.has(date) && getKrxEndpointForDate(sources.get(asset.id)!, date) === endpoint)
      if (matching.length === 0) continue
      const expectedSymbols = new Set(matching.map((asset) => sources.get(asset.id)!.symbol))
      const rows = await fetchKrxOpenApiMarketCapRows({
        endpoint,
        date,
        expectedSymbols,
        authKey: options.krxAuthKey,
        cacheRoot: CACHE_ROOT,
        force: options.force,
        delayMs: options.krxDelayMs,
      })
      const rowBySymbol = new Map(rows.map((row) => [row.symbol, row]))
      for (const asset of matching) {
        const source = sources.get(asset.id)!
        const row = rowBySymbol.get(source.symbol)
        if (!row) throw new Error(`${asset.id}: KRX OPEN API did not return the mapped security on ${date}`)
        assertKrxIdentity(asset, source, row.name)
        const price = barsByDate.get(asset.id)!.get(date)!
        if (price.open !== row.open || price.close !== row.close) {
          throw new Error(`${asset.id}: KRX OPEN API identity price check failed on ${date}`)
        }
        const calculatedClose = cap(row.close, row.listedShares)
        if (Math.abs(calculatedClose - row.marketCap) > Math.max(1, row.marketCap) * 1e-9) {
          throw new Error(`${asset.id}: KRX MKTCAP does not match LIST_SHRS × close on ${date}`)
        }
        const prior = capBars.get(asset.id)!.at(-1)
        capBars.get(asset.id)!.push({
          date,
          preopen: prior?.close ?? null,
          open: cap(row.open, row.listedShares),
          close: row.marketCap,
        })
      }
    }
  }

  return new Map(assets.map((asset) => [asset.id, {
    schemaVersion: 1,
    id: asset.id,
    market: 'KR' as const,
    currency: 'KRW' as const,
    source: {
      authoritativeProvider: 'KRX OPEN API',
      methodology: 'Official KRX MKTCAP/LIST_SHRS with the existing KRX KIND unadjusted price identity checked for each trading date.',
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
  const tickerPayload = await fetchSecCompanyTickers({ cacheRoot: CACHE_ROOT, force: options.force, delayMs: options.secDelayMs, userAgent: options.secUserAgent })
  const result = new Map<string, AssetMarketCapitalizationSeries>()

  for (const [index, asset] of assets.entries()) {
    console.log(`SEC shares ${index + 1}/${assets.length}: ${asset.id}`)
    const source = sources.get(asset.id)!
    const cik = resolveSecCikForTicker(tickerPayload, source.symbol)
    const facts = await fetchSecCompanyFacts(cik, { cacheRoot: CACHE_ROOT, force: options.force, delayMs: options.secDelayMs, userAgent: options.secUserAgent })
    const snapshots = normalizeSecSharesOutstandingCompanyFacts(facts)
    if (snapshots.length === 0) throw new Error(`${asset.id}: SEC EDGAR has no usable shares-outstanding facts`)
    const priceBars = prices.get(asset.id)!.bars
    const splits = splitEventsFor(asset.id)
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
        methodology: 'Existing unadjusted Nasdaq price × latest SEC shares outstanding filed before the trading date; verified split ratios align share and price dates.',
        generatedAt,
      },
      bars,
    })
  }
  return result
}

function latestGidsRow(rows: NasdaqGidsSharesRow[], date: string): NasdaqGidsSharesRow | null {
  let selected: NasdaqGidsSharesRow | null = null
  for (const row of rows) {
    if (row.date > date) break
    selected = row
  }
  return selected
}

async function buildUsEtfs(
  assets: CatalogAsset[],
  prices: Map<string, AssetPriceSeries>,
  sources: Map<string, NasdaqAssetSource>,
  options: BuildOptions,
  generatedAt: string,
): Promise<Map<string, AssetMarketCapitalizationSeries>> {
  if (!(await pathExists(options.gidsPath))) throw new Error(`Nasdaq GIDS TSO input is missing: ${options.gidsPath}`)
  const input = parseNormalizedNasdaqGidsSharesCsv(await readFile(options.gidsPath, 'utf8'))
  const bySymbol = new Map<string, NasdaqGidsSharesRow[]>()
  for (const row of input) {
    const rows = bySymbol.get(row.symbol) ?? []
    rows.push(row)
    bySymbol.set(row.symbol, rows)
  }

  const result = new Map<string, AssetMarketCapitalizationSeries>()
  for (const asset of assets) {
    const source = sources.get(asset.id)!
    const shareRows = bySymbol.get(source.symbol)?.sort((left, right) => left.date.localeCompare(right.date)) ?? []
    if (shareRows.length === 0) throw new Error(`${asset.id}: Nasdaq GIDS TSO input has no rows for the private symbol`)
    const priceBars = prices.get(asset.id)!.bars
    const splits = splitEventsFor(asset.id)
    const bars = priceBars.map((bar, barIndex): DailyMarketCapitalizationBar => {
      const row = latestGidsRow(shareRows, bar.date)
      if (!row) return { date: bar.date, preopen: null, open: null, close: null }
      const shares = alignSharesToPriceDate(row.totalSharesOutstanding, row.date, bar.date, splits)
      const previousPrice = barIndex > 0 ? priceBars[barIndex - 1] : null
      const previousShares = previousPrice
        ? alignSharesToPriceDate(row.totalSharesOutstanding, row.date, previousPrice.date, splits)
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
        authoritativeProvider: 'Nasdaq Historical Quotes + Nasdaq GIDS',
        methodology: 'Existing unadjusted Nasdaq price × latest Nasdaq GIDS Total Shares Outstanding available for the session; verified split ratios align TSO and price dates.',
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
    gidsPath: process.env.NASDAQ_GIDS_ETF_TSO_PATH ?? DEFAULT_GIDS_PATH,
    krxAuthKey: envRequired('KRX_OPEN_API_AUTH_KEY'),
    secUserAgent: envRequired('SEC_USER_AGENT'),
    force: process.argv.includes('--force'),
    krxDelayMs: envNumber('KRX_OPEN_API_REQUEST_DELAY_MS', 80),
    secDelayMs: envNumber('SEC_REQUEST_DELAY_MS', 120),
  }
  const manifest = parseMarketDataManifest(await readJson(join(DATA_ROOT, 'manifest.json')))
  const prices = await loadPrices(manifest)
  const sourceMap = await loadMarketSourceMap(options.sourceMapPath, false)
  const krAssets = ASSET_CATALOG.filter((asset) => asset.market === 'KR')
  const usStocks = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'stock')
  const usEtfs = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'etf')
  const krSources = new Map<string, KrxAssetSource>()
  const usSources = new Map<string, NasdaqAssetSource>()

  for (const asset of krAssets) {
    const source = sourceMap.assets.get(asset.id)
    if (!source || source.provider !== 'KRX') throw new Error(`${asset.id}: missing KRX private mapping`)
    krSources.set(asset.id, source)
  }
  for (const asset of [...usStocks, ...usEtfs]) {
    const source = sourceMap.assets.get(asset.id)
    if (!source || source.provider !== 'NASDAQ') throw new Error(`${asset.id}: missing Nasdaq private mapping`)
    usSources.set(asset.id, source)
  }

  const generatedAt = new Date().toISOString()
  const korean = await buildKorean(krAssets, prices, krSources, options, generatedAt)
  const stocks = await buildUsStocks(usStocks, prices, usSources, options, generatedAt)
  const etfs = await buildUsEtfs(usEtfs, prices, usSources, options, generatedAt)
  const all = new Map<string, AssetMarketCapitalizationSeries>([...korean, ...stocks, ...etfs])
  if (all.size !== ASSET_CATALOG.length) throw new Error(`Expected ${ASSET_CATALOG.length} market-cap series; built ${all.size}`)

  for (const asset of ASSET_CATALOG) {
    const series = all.get(asset.id)!
    if (series.bars.length !== prices.get(asset.id)!.bars.length) throw new Error(`${asset.id}: market-cap and price lengths differ`)
    await writeJsonAtomic(join(DATA_ROOT, marketCapPath(asset)), series)
  }

  const currentById = new Map(manifest.assets.map((item) => [item.id, item]))
  const assets: AssetManifestItem[] = ASSET_CATALOG.map((asset) => {
    const item = currentById.get(asset.id)
    if (!item) throw new Error(`Manifest is missing ${asset.id}`)
    return { ...item, marketCapPath: marketCapPath(asset) }
  })
  await writeJsonAtomic(join(DATA_ROOT, 'manifest.json'), { ...manifest, assets } satisfies MarketDataManifest)
  console.log(`Historical market-cap build complete for ${all.size} assets.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
