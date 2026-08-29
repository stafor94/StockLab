import { resolve } from 'node:path'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { readJson } from './io'
import type { NasdaqAssetClass } from './providers/nasdaq'

type JsonRecord = Record<string, unknown>

export type KrxEndpoint = 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd'

export interface KrxEndpointChange {
  effectiveFrom: string
  endpoint: KrxEndpoint
}

export interface KrxAssetSource {
  provider: 'KRX'
  endpoint: KrxEndpoint
  endpointChanges: KrxEndpointChange[]
  symbol: string
  isin?: string
  expectedName?: string
}

export interface NasdaqAssetSource {
  provider: 'NASDAQ'
  assetClass: NasdaqAssetClass
  symbol: string
}

export type AssetSource = KrxAssetSource | NasdaqAssetSource

export interface MarketSourceMap {
  schemaVersion: 1
  assets: Map<string, AssetSource>
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as JsonRecord
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`)
  return value.trim()
}

function optionalNonEmptyString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  return nonEmptyString(value, label)
}

function parseKrxEndpoint(value: unknown, label: string): KrxEndpoint {
  const endpoint = nonEmptyString(value, label)
  if (endpoint !== 'stk_bydd_trd' && endpoint !== 'ksq_bydd_trd' && endpoint !== 'etf_bydd_trd') {
    throw new Error(`${label} is not a supported KRX endpoint`)
  }
  return endpoint
}

function parseEndpointChanges(value: unknown, assetId: string): KrxEndpointChange[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`${assetId}.endpointChanges must be an array`)
  const changes = value.map((entry, index) => {
    const item = record(entry, `${assetId}.endpointChanges[${index}]`)
    const effectiveFrom = nonEmptyString(item.effectiveFrom, `${assetId}.endpointChanges[${index}].effectiveFrom`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error(`${assetId}.endpointChanges[${index}].effectiveFrom must use YYYY-MM-DD`)
    return { effectiveFrom, endpoint: parseKrxEndpoint(item.endpoint, `${assetId}.endpointChanges[${index}].endpoint`) }
  }).sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
  for (let index = 1; index < changes.length; index += 1) {
    if (changes[index - 1].effectiveFrom === changes[index].effectiveFrom) throw new Error(`${assetId}.endpointChanges contains duplicate effective date ${changes[index].effectiveFrom}`)
  }
  return changes
}

function parseNasdaqAssetClass(value: unknown, label: string): NasdaqAssetClass {
  if (value !== 'stocks' && value !== 'etf') throw new Error(`${label} must be stocks or etf`)
  return value
}

function parseSource(value: unknown, assetId: string): AssetSource {
  const item = record(value, `source map ${assetId}`)
  const provider = nonEmptyString(item.provider, `${assetId}.provider`)
  const symbol = nonEmptyString(item.symbol, `${assetId}.symbol`)
  if (provider === 'NASDAQ') return { provider, assetClass: parseNasdaqAssetClass(item.assetClass, `${assetId}.assetClass`), symbol }
  if (provider === 'KRX') return {
    provider,
    endpoint: parseKrxEndpoint(item.endpoint, `${assetId}.endpoint`),
    endpointChanges: parseEndpointChanges(item.endpointChanges, assetId),
    symbol,
    isin: optionalNonEmptyString(item.isin, `${assetId}.isin`)?.toUpperCase(),
    expectedName: optionalNonEmptyString(item.expectedName, `${assetId}.expectedName`),
  }
  throw new Error(`${assetId}.provider must be KRX or NASDAQ`)
}

function validateKrxSourceForAsset(asset: CatalogAsset, source: KrxAssetSource): void {
  if (!/^\d{6}$/.test(source.symbol)) throw new Error(`${asset.id}.symbol must be a 6-digit KRX short code`)
  if (source.isin && !/^KR[A-Z0-9]{10}$/.test(source.isin)) throw new Error(`${asset.id}.isin must be a 12-character Korean ISIN`)
  const endpoints = getKrxSourceEndpoints(source)
  if (asset.kind === 'etf' && endpoints.some((endpoint) => endpoint !== 'etf_bydd_trd')) throw new Error(`${asset.id} is a Korean ETF and every KRX endpoint must be etf_bydd_trd`)
  if (asset.kind === 'stock' && endpoints.includes('etf_bydd_trd')) throw new Error(`${asset.id} is a Korean stock and cannot use KRX etf_bydd_trd`)
}

async function rawSourceMap(sourceMapPath: string): Promise<JsonRecord> {
  const root = record(await readJson(resolve(sourceMapPath)), 'source map')
  if (root.schemaVersion !== 1) throw new Error('source map schemaVersion must be 1')
  return record(root.assets, 'source map assets')
}

export function getKrxEndpointForDate(source: KrxAssetSource, date: string): KrxEndpoint {
  let endpoint = source.endpoint
  for (const change of source.endpointChanges) {
    if (change.effectiveFrom > date) break
    endpoint = change.endpoint
  }
  return endpoint
}

export function getKrxSourceEndpoints(source: KrxAssetSource): KrxEndpoint[] {
  return [...new Set([source.endpoint, ...source.endpointChanges.map((change) => change.endpoint)])]
}

export async function loadKoreanMarketSourceMap(sourceMapPath: string): Promise<Map<string, KrxAssetSource>> {
  const rawAssets = await rawSourceMap(sourceMapPath)
  const koreanCatalog = ASSET_CATALOG.filter((asset) => asset.market === 'KR')
  const koreanIds = new Set(koreanCatalog.map((asset) => asset.id))
  for (const assetId of Object.keys(rawAssets)) {
    if (assetId.startsWith('K') && !koreanIds.has(assetId)) throw new Error(`source map contains unknown Korean asset ${assetId}`)
  }
  const assets = new Map<string, KrxAssetSource>()
  for (const asset of koreanCatalog) {
    const rawSource = rawAssets[asset.id]
    if (rawSource === undefined) continue
    const source = parseSource(rawSource, asset.id)
    if (source.provider !== 'KRX') throw new Error(`${asset.id} must use KRX because it is a Korean asset`)
    validateKrxSourceForAsset(asset, source)
    assets.set(asset.id, source)
  }
  return assets
}

export async function loadMarketSourceMap(sourceMapPath: string, allowPartial: boolean): Promise<MarketSourceMap> {
  const rawAssets = await rawSourceMap(sourceMapPath)
  const assets = new Map<string, AssetSource>()
  for (const [assetId, rawSource] of Object.entries(rawAssets)) assets.set(assetId, parseSource(rawSource, assetId))
  const catalogIds = new Set(ASSET_CATALOG.map((asset) => asset.id))
  for (const assetId of assets.keys()) if (!catalogIds.has(assetId)) throw new Error(`source map contains unknown asset ${assetId}`)
  for (const asset of ASSET_CATALOG) {
    const source = assets.get(asset.id)
    if (!source) {
      if (!allowPartial) throw new Error(`source map is missing ${asset.id} (${asset.alias})`)
      continue
    }
    if (asset.market === 'US') {
      if (source.provider !== 'NASDAQ') throw new Error(`${asset.id} must use Nasdaq Historical Quotes because it is a U.S. asset`)
      if (asset.kind === 'stock' && source.assetClass !== 'stocks') throw new Error(`${asset.id} is a U.S. stock and must use Nasdaq assetClass=stocks`)
      if (asset.kind === 'etf' && source.assetClass !== 'etf') throw new Error(`${asset.id} is a U.S. ETF and must use Nasdaq assetClass=etf`)
      continue
    }
    if (source.provider !== 'KRX') throw new Error(`${asset.id} must use KRX because it is a Korean asset`)
    validateKrxSourceForAsset(asset, source)
  }
  return { schemaVersion: 1, assets }
}

export async function loadMarketCapSourceMap(sourceMapPath: string): Promise<MarketSourceMap> {
  const sourceMap = await loadMarketSourceMap(sourceMapPath, true)
  const supportedAssets = ASSET_CATALOG.filter((asset) => asset.market === 'KR' || (asset.market === 'US' && asset.kind === 'stock'))
  for (const asset of supportedAssets) {
    if (!sourceMap.assets.has(asset.id)) throw new Error(`${asset.id}: market-cap source map is missing a supported asset`)
  }
  return sourceMap
}
