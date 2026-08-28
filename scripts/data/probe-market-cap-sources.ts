import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { parseKrxKindIssuerInfo } from '../../src/data/ingestion/krxKindHistorical'
import {
  fetchKrxKindHistoricalResponse,
  fetchKrxKindIssuerLookup,
  openKrxKindSession,
} from './providers/krx-kind'
import { fetchNasdaqInfoPayload } from './providers/nasdaq'
import { loadMarketSourceMap } from './source-map'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const sourceMapPath = process.env.MARKET_SOURCE_MAP_PATH ?? join(ROOT, '.private', 'market-source-map.json')
const cacheRoot = join(ROOT, '.cache', 'market-data-probe')

function objectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.keys(value as Record<string, unknown>).sort()
}

function firstChartRow(responseText: string): unknown {
  const match = responseText.match(/var\s+dataDisclsAnalysisChart\s*=\s*(\[.*?\]);/s)
  if (!match) throw new Error('KRX KIND chart payload missing')
  const rows = JSON.parse(match[1]) as unknown
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('KRX KIND chart payload has no rows')
  return rows[0]
}

async function main(): Promise<void> {
  const sourceMap = await loadMarketSourceMap(sourceMapPath, true)

  const krAsset = ASSET_CATALOG.find((asset) => asset.market === 'KR')
  if (!krAsset) throw new Error('No Korean asset configured')
  const krSource = sourceMap.assets.get(krAsset.id)
  if (!krSource || krSource.provider !== 'KRX') throw new Error('Korean probe source unavailable')

  const issuerXml = await fetchKrxKindIssuerLookup(krSource.symbol, { cacheRoot, force: true, delayMs: 120 })
  const issuer = parseKrxKindIssuerInfo(issuerXml, krSource.symbol)
  const session = await openKrxKindSession(issuer.issuerCode, 120)
  const responseText = await fetchKrxKindHistoricalResponse({
    symbol: krSource.symbol,
    issuerCode: issuer.issuerCode,
    from: '2019-08-01',
    to: '2019-08-09',
    session,
    cacheRoot,
    force: true,
    delayMs: 120,
  })
  console.log(`KR_KIND_CHART_KEYS=${objectKeys(firstChartRow(responseText)).join(',')}`)

  const usAsset = ASSET_CATALOG.find((asset) => asset.market === 'US' && asset.kind === 'stock')
  if (!usAsset) throw new Error('No U.S. stock configured')
  const usSource = sourceMap.assets.get(usAsset.id)
  if (!usSource || usSource.provider !== 'NASDAQ') throw new Error('U.S. probe source unavailable')
  const info = await fetchNasdaqInfoPayload({
    symbol: usSource.symbol,
    assetClass: usSource.assetClass,
    cacheRoot,
    force: true,
    delayMs: 100,
  })
  const root = info as Record<string, unknown>
  const data = root.data as Record<string, unknown> | null | undefined
  console.log(`NASDAQ_INFO_KEYS=${objectKeys(data).join(',')}`)
  if (data) {
    for (const key of objectKeys(data)) {
      const child = data[key]
      const keys = objectKeys(child)
      if (keys.length > 0) console.log(`NASDAQ_INFO_${key.toUpperCase()}_KEYS=${keys.join(',')}`)
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
