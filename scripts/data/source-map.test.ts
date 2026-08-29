import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSET_CATALOG } from '../../config/assets'
import { buildAndPersistUsMarketData } from './us-market-builder'
import {
  getKrxEndpointForDate,
  getKrxSourceEndpoints,
  loadKoreanMarketSourceMap,
  loadMarketCapSourceMap,
  loadMarketSourceMap,
  type KrxAssetSource,
} from './source-map'

const source: KrxAssetSource = {
  provider: 'KRX',
  symbol: '000000',
  endpoint: 'ksq_bydd_trd',
  endpointChanges: [{ effectiveFrom: '2018-02-09', endpoint: 'stk_bydd_trd' }],
}

async function withSourceMap(assets: Record<string, unknown>, run: (path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'stocklab-source-map-'))
  const path = join(directory, 'market-source-map.json')
  try {
    await writeFile(path, JSON.stringify({ schemaVersion: 1, assets }), 'utf8')
    await run(path)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function supportedMarketCapSources(): Record<string, unknown> {
  const assets: Record<string, unknown> = {}
  let koreanIndex = 0
  let usIndex = 0
  for (const asset of ASSET_CATALOG) {
    if (asset.market === 'KR') {
      koreanIndex += 1
      assets[asset.id] = {
        provider: 'KRX',
        endpoint: asset.kind === 'etf' ? 'etf_bydd_trd' : 'stk_bydd_trd',
        endpointChanges: [],
        symbol: String(koreanIndex).padStart(6, '0'),
      }
      continue
    }
    if (asset.kind === 'stock') {
      usIndex += 1
      assets[asset.id] = {
        provider: 'NASDAQ',
        assetClass: 'stocks',
        symbol: `ZZTEST${usIndex}`,
        secCik: 1_000_000 + usIndex,
      }
    }
  }
  return assets
}

describe('KRX source venue history', () => {
  it('uses the endpoint effective on the requested date', () => {
    expect(getKrxEndpointForDate(source, '2018-02-08')).toBe('ksq_bydd_trd')
    expect(getKrxEndpointForDate(source, '2018-02-09')).toBe('stk_bydd_trd')
  })
  it('reports every required endpoint', () => expect(getKrxSourceEndpoints(source)).toEqual(['ksq_bydd_trd', 'stk_bydd_trd']))
})

describe('source-map provider policy', () => {
  it('parses Korean KRX entries independently of U.S. entries', async () => {
    await withSourceMap({
      K001: { provider: 'KRX', endpoint: 'stk_bydd_trd', endpointChanges: [], symbol: '000001' },
      U001: { provider: 'NASDAQ', assetClass: 'stocks', symbol: 'ZZTESTSTOCK', secCik: 1_000_001 },
    }, async (path) => {
      const korean = await loadKoreanMarketSourceMap(path)
      expect([...korean.keys()]).toEqual(['K001'])
      expect(korean.get('K001')?.symbol).toBe('000001')
    })
  })

  it('rejects malformed Korean short codes', async () => {
    await withSourceMap({ K001: { provider: 'KRX', endpoint: 'stk_bydd_trd', endpointChanges: [], symbol: '1234' } }, async (path) => {
      await expect(loadKoreanMarketSourceMap(path)).rejects.toThrow(/6-digit KRX short code/)
    })
  })

  it('accepts Nasdaq stock/ETF classes and optional SEC provider metadata', async () => {
    await withSourceMap({
      U001: { provider: 'NASDAQ', assetClass: 'stocks', symbol: 'ZZTESTSTOCK', secCik: 1_000_001 },
      UE001: { provider: 'NASDAQ', assetClass: 'etf', symbol: 'ZZTESTETF' },
    }, async (path) => {
      const map = await loadMarketSourceMap(path, true)
      expect(map.assets.get('U001')).toEqual({ provider: 'NASDAQ', assetClass: 'stocks', symbol: 'ZZTESTSTOCK', secCik: 1_000_001 })
      expect(map.assets.get('UE001')).toEqual({ provider: 'NASDAQ', assetClass: 'etf', symbol: 'ZZTESTETF' })
    })
  })

  it('rejects legacy U.S. providers and mismatched Nasdaq classes', async () => {
    await withSourceMap({ U001: { provider: 'STOOQ', symbol: 'ZZTEST.US' } }, async (path) => {
      await expect(loadMarketSourceMap(path, true)).rejects.toThrow(/KRX or NASDAQ/)
    })
    await withSourceMap({ U001: { provider: 'NASDAQ', assetClass: 'etf', symbol: 'ZZTESTSTOCK' } }, async (path) => {
      await expect(loadMarketSourceMap(path, true)).rejects.toThrow(/assetClass=stocks/)
    })
  })

  it('accepts exactly the 97 supported market-cap mappings while full U.S. price build stays strict', async () => {
    await withSourceMap(supportedMarketCapSources(), async (path) => {
      const map = await loadMarketCapSourceMap(path)
      const koreanCount = ASSET_CATALOG.filter((asset) => asset.market === 'KR' && map.assets.has(asset.id)).length
      const usStockCount = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'stock' && map.assets.has(asset.id)).length
      const usEtfCount = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'etf' && map.assets.has(asset.id)).length
      expect(map.assets.size).toBe(97)
      expect(koreanCount).toBe(52)
      expect(usStockCount).toBe(45)
      expect(usEtfCount).toBe(0)

      await expect(buildAndPersistUsMarketData({
        from: '2018-01-01',
        to: '2018-01-02',
        sourceMapPath: path,
        outputRoot: tmpdir(),
        cacheRoot: tmpdir(),
        force: false,
        requestDelayMs: 0,
      })).rejects.toThrow(/must contain a NASDAQ mapping/)
    })
  })
})
