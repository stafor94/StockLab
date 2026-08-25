import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketDataClient, MarketDataLoadError } from './marketDataClient'

const manifest = {
  schemaVersion: 1,
  calendars: { KR: 'calendars/kr.json', US: 'calendars/us.json' },
  assets: [
    {
      id: 'K001',
      alias: '영진전자',
      kind: 'stock',
      market: 'KR',
      currency: 'KRW',
      sector: '반도체·전자',
      listedFrom: '2018-01-01',
      dataPath: 'stocks/kr/K001.json',
    },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MarketDataClient', () => {
  it('caches the manifest and lazy-loads an asset only when requested', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const payload = url.endsWith('manifest.json')
        ? manifest
        : {
            schemaVersion: 1,
            id: 'K001',
            market: 'KR',
            kind: 'stock',
            currency: 'KRW',
            bars: [],
          }
      return { ok: true, status: 200, json: async () => payload } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new MarketDataClient('/StockLab/data/')
    await client.loadManifest()
    await client.loadManifest()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const asset = await client.loadAssetPriceSeries('K001')
    expect(asset.id).toBe('K001')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails clearly for an unknown asset id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ...manifest, assets: [] }),
    } as Response)))

    const client = new MarketDataClient('/StockLab/data/')
    await expect(client.loadAssetPriceSeries('UNKNOWN')).rejects.toBeInstanceOf(MarketDataLoadError)
  })
})
