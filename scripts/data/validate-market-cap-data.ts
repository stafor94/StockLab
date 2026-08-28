import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { parseAssetMarketCapitalizationSeries, parseAssetPriceSeries, parseMarketDataManifest } from '../../src/data/schema'
import type { DailyMarketCapitalizationBar } from '../../src/types/market'
import { readJson } from './io'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DATA_ROOT = join(ROOT, 'public', 'data')

function expectedPath(market: 'KR' | 'US', assetId: string): string {
  return `market-cap/${market.toLowerCase()}/${assetId}.json`
}

function supportsMarketCap(asset: CatalogAsset): boolean {
  return asset.market === 'KR' || (asset.market === 'US' && asset.kind === 'stock')
}

function positiveOrNull(value: number | null, label: string): number | null {
  if (value === null) return null
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be null or a positive market capitalization`)
  return value
}

function validateBars(
  assetId: string,
  market: 'KR' | 'US',
  capBars: DailyMarketCapitalizationBar[],
  priceBars: Array<{ date: string; open: number; close: number }>,
): void {
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
  const supportedAssets = ASSET_CATALOG.filter(supportsMarketCap)
  const supportedIds = new Set(supportedAssets.map((asset) => asset.id))
  const withMarketCap = manifest.assets.filter((asset) => asset.marketCapPath)
  if (withMarketCap.length === 0) {
    console.log('Historical market-cap dataset has not been generated yet.')
    return
  }
  if (manifest.assets.length !== ASSET_CATALOG.length || withMarketCap.length !== supportedAssets.length) {
    throw new Error(`Historical market-cap data must cover exactly the ${supportedAssets.length} supported Korean assets and U.S. stocks`)
  }

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
  console.log(`Validated ${supportedAssets.length} supported historical market-cap series with ${totalBars} bars; U.S. ETFs remain intentionally unavailable.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
