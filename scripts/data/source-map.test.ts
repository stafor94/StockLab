import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getKrxEndpointForDate,
  getKrxSourceEndpoints,
  loadKoreanMarketSourceMap,
  loadMarketSourceMap,
  type KrxAssetSource,
} from './source-map'

const source: KrxAssetSource = {
  provider: 'KRX',
  symbol: '000000',
  endpoint: 'ksq_bydd_trd',
  endpointChanges: [{ effectiveFrom: '2018-02-09', endpoint: 'stk_bydd_trd' }],
}

async function withSourceMap(
  assets: Record<string, unknown>,
  run: (path: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'stocklab-source-map-'))
  const path = join(directory, 'market-source-map.json')
  try {
    await writeFile(path, JSON.stringify({ schemaVersion: 1, assets }), 'utf8')
    await run(path)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('KRX source venue history', () => {
  it('uses the endpoint that was effective on the requested trading date', () => {
    expect(getKrxEndpointForDate(source, '2018-02-08')).toBe('ksq_bydd_trd')
    expect(getKrxEndpointForDate(source, '2018-02-09')).toBe('stk_bydd_trd')
    expect(getKrxEndpointForDate(source, '2026-08-25')).toBe('stk_bydd_trd')
  })

  it('reports every endpoint required by historical venue metadata', () => {
    expect(getKrxSourceEndpoints(source)).toEqual(['ksq_bydd_trd', 'stk_bydd_trd'])
  })
})

describe('private source-map provider policy', () => {
  it('parses Korean KRX entries without depending on U.S. entries', async () => {
    await withSourceMap({
      K001: {
        provider: 'KRX',
        endpoint: 'stk_bydd_trd',
        endpointChanges: [],
        symbol: '005930',
      },
      U001: {
        provider: 'STOOQ',
        symbol: 'AAPL.US',
      },
    }, async (path) => {
      const korean = await loadKoreanMarketSourceMap(path)
      expect([...korean.keys()]).toEqual(['K001'])
      expect(korean.get('K001')?.symbol).toBe('005930')
    })
  })

  it('rejects malformed Korean short codes before any network request', async () => {
    await withSourceMap({
      K001: {
        provider: 'KRX',
        endpoint: 'stk_bydd_trd',
        endpointChanges: [],
        symbol: '5930',
      },
    }, async (path) => {
      await expect(loadKoreanMarketSourceMap(path)).rejects.toThrow(/6-digit KRX short code/)
    })
  })

  it('accepts Stooq U.S. identifiers and rejects legacy U.S. providers', async () => {
    await withSourceMap({
      U001: { provider: 'STOOQ', symbol: 'AAPL.US' },
    }, async (path) => {
      const map = await loadMarketSourceMap(path, true)
      expect(map.assets.get('U001')).toEqual({ provider: 'STOOQ', symbol: 'AAPL.US' })
    })

    await withSourceMap({
      U001: { provider: 'ALPHA_VANTAGE', symbol: 'AAPL' },
    }, async (path) => {
      await expect(loadMarketSourceMap(path, true)).rejects.toThrow(/KRX or STOOQ/)
    })
  })

  it('rejects ambiguous Stooq symbols without the U.S. market suffix', async () => {
    await withSourceMap({
      U001: { provider: 'STOOQ', symbol: 'AAPL' },
    }, async (path) => {
      await expect(loadMarketSourceMap(path, true)).rejects.toThrow(/ending in \.US/)
    })
  })
})
