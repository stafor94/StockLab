import { resolve } from 'node:path'
import { ASSET_CATALOG } from '../../config/assets'
import { readJson } from './io'

type JsonRecord = Record<string, unknown>

export type KrxEndpoint = 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd'

export interface KrxAssetSource {
  provider: 'KRX'
  endpoint: KrxEndpoint
  symbol: string
}

export interface AlphaVantageAssetSource {
  provider: 'ALPHA_VANTAGE'
  symbol: string
}

export type AssetSource = KrxAssetSource | AlphaVantageAssetSource

export interface MarketSourceMap {
  schemaVersion: 1
  assets: Map<string, AssetSource>
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as JsonRecord
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value.trim()
}

function parseSource(value: unknown, assetId: string): AssetSource {
  const item = record(value, `source map ${assetId}`)
  const provider = nonEmptyString(item.provider, `${assetId}.provider`)
  const symbol = nonEmptyString(item.symbol, `${assetId}.symbol`)

  if (provider === 'ALPHA_VANTAGE') {
    return { provider, symbol }
  }

  if (provider === 'KRX') {
    const endpoint = nonEmptyString(item.endpoint, `${assetId}.endpoint`)
    if (endpoint !== 'stk_bydd_trd' && endpoint !== 'ksq_bydd_trd' && endpoint !== 'etf_bydd_trd') {
      throw new Error(`${assetId}.endpoint is not a supported KRX endpoint`)
    }
    return { provider, endpoint, symbol }
  }

  throw new Error(`${assetId}.provider must be KRX or ALPHA_VANTAGE`)
}

export async function loadMarketSourceMap(
  sourceMapPath: string,
  allowPartial: boolean,
): Promise<MarketSourceMap> {
  const root = record(await readJson(resolve(sourceMapPath)), 'source map')
  if (root.schemaVersion !== 1) {
    throw new Error('source map schemaVersion must be 1')
  }
  const rawAssets = record(root.assets, 'source map assets')
  const assets = new Map<string, AssetSource>()
  for (const [assetId, rawSource] of Object.entries(rawAssets)) {
    assets.set(assetId, parseSource(rawSource, assetId))
  }

  const catalogIds = new Set(ASSET_CATALOG.map((asset) => asset.id))
  for (const assetId of assets.keys()) {
    if (!catalogIds.has(assetId)) {
      throw new Error(`source map contains unknown asset ${assetId}`)
    }
  }

  for (const asset of ASSET_CATALOG) {
    const source = assets.get(asset.id)
    if (!source) {
      if (!allowPartial) {
        throw new Error(`source map is missing ${asset.id} (${asset.alias})`)
      }
      continue
    }

    if (asset.market === 'US' && source.provider !== 'ALPHA_VANTAGE') {
      throw new Error(`${asset.id} must use Alpha Vantage because it is a U.S. asset`)
    }
    if (asset.market === 'KR' && source.provider !== 'KRX') {
      throw new Error(`${asset.id} must use KRX because it is a Korean asset`)
    }
    if (asset.kind === 'etf' && asset.market === 'KR' && source.provider === 'KRX' && source.endpoint !== 'etf_bydd_trd') {
      throw new Error(`${asset.id} is a Korean ETF and must use KRX etf_bydd_trd`)
    }
    if (asset.kind === 'stock' && asset.market === 'KR' && source.provider === 'KRX' && source.endpoint === 'etf_bydd_trd') {
      throw new Error(`${asset.id} is a Korean stock and cannot use KRX etf_bydd_trd`)
    }
  }

  return { schemaVersion: 1, assets }
}
