import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getKrxEndpointForDate,
  getKrxSourceEndpoints,
  loadKoreanMarketSourceMap,
  type KrxAssetSource,
} from './source-map'

const source: KrxAssetSource = {
  provider: 'KRX',
  symbol: '000000',
  endpoint: 'ksq_bydd_trd',
  endpointChanges: [{ effectiveFrom: '2018-02-09', endpoint: 'stk_bydd_trd' }],
}

describe('KRX source venue history', () => {
  it('uses the endpoint that was effective on the requested trading date', () => {
    expect(getKrxEndpointForDate(source, '2018-02-08')).toBe('ksq_bydd_trd')
    expect(getKrxEndpointForDate(source, '2018-02-09')).toBe('stk_bydd_trd')
    expect(getKrxEndpointForDate(source, '2026-08-25')).toBe('stk_bydd_trd')
  })

  it('reports every endpoint required by the history builder', () => {
    expect(getKrxSourceEndpoints(source)).toEqual(['ksq_bydd_trd', 'stk_bydd_trd'])
  })
})

describe('Korean private source-map isolation', () => {
  it('parses Korean KRX entries without depending on the U.S. provider schema', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stocklab-kr-map-'))
    const path = join(directory, 'market-source-map.json')
    try {
      await writeFile(path, JSON.stringify({
        schemaVersion: 1,
        assets: {
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
        },
      }), 'utf8')

      const korean = await loadKoreanMarketSourceMap(path)
      expect([...korean.keys()]).toEqual(['K001'])
      expect(korean.get('K001')?.symbol).toBe('005930')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects malformed Korean short codes before any network request', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stocklab-kr-map-'))
    const path = join(directory, 'market-source-map.json')
    try {
      await writeFile(path, JSON.stringify({
        schemaVersion: 1,
        assets: {
          K001: {
            provider: 'KRX',
            endpoint: 'stk_bydd_trd',
            endpointChanges: [],
            symbol: '5930',
          },
        },
      }), 'utf8')

      await expect(loadKoreanMarketSourceMap(path)).rejects.toThrow(/6-digit KRX short code/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
