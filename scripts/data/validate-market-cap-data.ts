import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { parseAssetMarketCapitalizationSeries, parseAssetPriceSeries, parseMarketDataManifest } from '../../src/data/schema'
import type { DailyMarketCapitalizationBar } from '../../src/types/market'
import { readJson } from './io'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')
const EXPECTED_KR_MARKET_CAP_COUNT = 52
const EXPECTED_US_STOCK_MARKET_CAP_COUNT = 45
const EXPECTED_SUPPORTED_MARKET_CAP_COUNT = 97
const EXPECTED_US_ETF_UNSUPPORTED_COUNT = 12

function expectedPath(market: 'KR' | 'US', assetId: string): string {
  return `market-cap/${market.toLowerCase()}/${assetId}.json`
}

function supportsMarketCap(asset: CatalogAsset): boolean {
  return asset.market === 'KR' || (asset.market === 'US' && asset.kind === 'stock')
}

function positiveOrNull(value: number | null, label: string): number | null {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be null or a positive safe-integer market capitalization`)
  return value
}

function validateBars(
  assetId: string,
  market: 'KR' | 'US',
  capBars: DailyMarketCapitalizationBar[],
  priceBars: Array<{ date: string; open: number; close: number }>,
): void {
  if (capBars.length === 0) throw new Error(`${assetId}: market-cap series must be non-empty`)
  if (capBars.length !== priceBars.length) throw new Error(`${assetId}: market-cap bars must align one-to-one with price bars`)
  let positiveCloseCount = 0
  let seenPositive = false
  for (let index = 0; index < capBars.length; index += 1) {
    const cap = capBars[index]
    const price = priceBars[index]
    if (cap.date !== price.date) throw new Error(`${assetId}: market-cap date ${cap.date} does not align with price date ${price.date}`)
    const preopen = positiveOrNull(cap.preopen, `${assetId} ${cap.date} preopen`)
    const open = positiveOrNull(cap.open, `${assetId} ${cap.date} open`)
    const close = positiveOrNull(cap.close, `${assetId} ${cap.date} close`)
    if (index === 0 && preopen !== null) throw new Error(`${assetId}: first market-cap preopen value must be null`)
    if (index > 0 && preopen !== capBars[index - 1].close) {
      throw new Error(`${assetId}: market-cap preopen must equal the previous trading bar close on ${cap.date}`)
    }
    if (market === 'KR' && (open === null || close === null)) throw new Error(`${assetId}: KRX market-cap values must be complete`)
    if ((open === null) !== (close === null)) throw new Error(`${assetId}: open and close market-cap availability must match`)
    if (open !== null && close !== null) {
      seenPositive = true
      positiveCloseCount += 1
      const openShares = open / price.open
      const closeShares = close / price.close
      if (Math.abs(openShares - closeShares) > Math.max(1, Math.abs(closeShares)) * 1e-9) {
        throw new Error(`${assetId}: open and close market caps imply different shares outstanding on ${cap.date}`)
      }
    } else if (seenPositive) {
      throw new Error(`${assetId}: market-cap coverage cannot become unavailable after it starts`)
    }
  }
  if (positiveCloseCount === 0) throw new Error(`${assetId}: market-cap series has no usable values`)
}

async function main(): Promise<void> {
  const manifest = parseMarketDataManifest(await readJson(join(DATA_ROOT, 'manifest.json')))
  const krAssets = ASSET_CATALOG.filter((asset) => asset.market === 'KR')
  const usStocks = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'stock')
  const usEtfs = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'etf')
  const supportedAssets = ASSET_CATALOG.filter(supportsMarketCap)

  if (
    krAssets.length !== EXPECTED_KR_MARKET_CAP_COUNT
    || usStocks.length !== EXPECTED_US_STOCK_MARKET_CAP_COUNT
    || supportedAssets.length !== EXPECTED_SUPPORTED_MARKET_CAP_COUNT
    || usEtfs.length !== EXPECTED_US_ETF_UNSUPPORTED_COUNT
  ) {
    throw new Error('Market-cap catalog contract changed; expected KR 52, U.S. stocks 45, supported total 97, and unsupported U.S. ETFs 12')
  }

  if (manifest.assets.length !== ASSET_CATALOG.length) {
    throw new Error(`Historical market-cap validation requires the complete ${ASSET_CATALOG.length}-asset manifest`)
  }
  const manifestById = new Map(manifest.assets.map((asset) => [asset.id, asset]))
  if (manifestById.size !== manifest.assets.length) throw new Error('Market data manifest contains duplicate asset IDs')

  let krWithMarketCap = 0
  let usStocksWithMarketCap = 0
  let usEtfsWithMarketCap = 0
  for (const asset of ASSET_CATALOG) {
    const item = manifestById.get(asset.id)
    if (!item) throw new Error(`${asset.id}: market data manifest entry is missing`)
    if (!item.marketCapPath) continue
    if (asset.market === 'KR') krWithMarketCap += 1
    else if (asset.kind === 'stock') usStocksWithMarketCap += 1
    else usEtfsWithMarketCap += 1
  }
  const totalWithMarketCap = krWithMarketCap + usStocksWithMarketCap + usEtfsWithMarketCap
  if (
    krWithMarketCap !== EXPECTED_KR_MARKET_CAP_COUNT
    || usStocksWithMarketCap !== EXPECTED_US_STOCK_MARKET_CAP_COUNT
    || totalWithMarketCap !== EXPECTED_SUPPORTED_MARKET_CAP_COUNT
    || usEtfsWithMarketCap !== 0
  ) {
    throw new Error(
      `Historical market-cap coverage must be KR ${EXPECTED_KR_MARKET_CAP_COUNT}, U.S. stocks ${EXPECTED_US_STOCK_MARKET_CAP_COUNT}, total ${EXPECTED_SUPPORTED_MARKET_CAP_COUNT}, and U.S. ETF marketCapPath 0; found KR ${krWithMarketCap}, U.S. stocks ${usStocksWithMarketCap}, total ${totalWithMarketCap}, U.S. ETFs ${usEtfsWithMarketCap}`,
    )
  }

  const supportedIds = new Set(supportedAssets.map((asset) => asset.id))
  const paths = new Set<string>()
  let totalBars = 0
  for (const asset of manifest.assets) {
    if (!supportedIds.has(asset.id)) {
      if (asset.marketCapPath) throw new Error(`${asset.id}: unsupported U.S. ETF must not publish marketCapPath`)
      continue
    }

    const path = asset.marketCapPath
    if (!path) throw new Error(`${asset.id}: marketCapPath is missing`)
    if (path !== expectedPath(asset.market, asset.id)) throw new Error(`${asset.id}: unexpected marketCapPath ${path}`)
    if (paths.has(path)) throw new Error(`Duplicate marketCapPath ${path}`)
    paths.add(path)

    const capSeries = parseAssetMarketCapitalizationSeries(await readJson(join(DATA_ROOT, path)))
    const priceSeries = parseAssetPriceSeries(await readJson(join(DATA_ROOT, asset.dataPath)))
    if (capSeries.id !== asset.id || capSeries.market !== asset.market || capSeries.currency !== asset.currency) {
      throw new Error(`${asset.id}: market-cap metadata does not match manifest metadata`)
    }
    const provider = capSeries.source.authoritativeProvider
    if (asset.market === 'KR' && provider !== 'KRX KIND') throw new Error(`${asset.id}: Korean market-cap source must be KRX KIND`)
    if (asset.market === 'US' && provider !== 'Nasdaq Historical Quotes + SEC EDGAR') {
      throw new Error(`${asset.id}: U.S. stock market-cap source must be Nasdaq prices + SEC EDGAR shares`)
    }
    validateBars(asset.id, asset.market, capSeries.bars, priceSeries.bars)
    totalBars += capSeries.bars.length
  }
  console.log(`Validated KR ${EXPECTED_KR_MARKET_CAP_COUNT}, U.S. stocks ${EXPECTED_US_STOCK_MARKET_CAP_COUNT}, total ${EXPECTED_SUPPORTED_MARKET_CAP_COUNT} historical market-cap series with ${totalBars} bars; ${EXPECTED_US_ETF_UNSUPPORTED_COUNT} U.S. ETFs remain intentionally unavailable.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
