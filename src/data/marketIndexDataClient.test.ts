import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketIndexDataClient } from './marketIndexDataClient'

const response = (value: unknown) => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(value),
} as Response)

afterEach(() => vi.restoreAllMocks())

describe('MarketIndexDataClient', () => {
  it('loads the dedicated manifest and all referenced series', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/manifest.json')) {
        return response({
          schemaVersion: 1,
          indices: [{ id: 'KOSPI', alias: '코스피', market: 'KR', dataPath: 'kr/KOSPI.json' }],
        })
      }
      return response({
        schemaVersion: 1,
        id: 'KOSPI',
        alias: '코스피',
        market: 'KR',
        source: {
          authoritativeProvider: 'KRX Data Marketplace',
          generatedAt: '2026-08-27T00:00:00.000Z',
          reference: 'https://data.krx.co.kr/',
        },
        bars: [{ date: '2017-12-29', open: 2437, high: 2470, low: 2435, close: 2467, volume: null }],
      })
    })

    const client = new MarketIndexDataClient('/data/indices')
    const series = await client.loadAllSeries()
    expect(series).toHaveLength(1)
    expect(series[0].id).toBe('KOSPI')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
