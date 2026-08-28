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

  it('can lazy-load a known catalog path before the generated manifest is populated', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        id: 'K001',
        market: 'KR',
        kind: 'stock',
        currency: 'KRW',
        bars: [],
      }),
    } as Response))
    vi.stubGlobal('fetch', fetchMock)

    const client = new MarketDataClient('/StockLab/data/')
    const asset = await client.loadAssetPriceSeriesAtPath('stocks/kr/K001.json')
    expect(asset.id).toBe('K001')
    expect(fetchMock).toHaveBeenCalledWith('/StockLab/data/stocks/kr/K001.json')
  })

  it('lazy-loads a point-in-time market-cap series by manifest path', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        id: 'K001',
        market: 'KR',
        currency: 'KRW',
        source: { authoritativeProvider: 'KRX OPEN API', methodology: 'fixture', generatedAt: '2026-08-28T00:00:00.000Z' },
        bars: [{ date: '2018-01-02', preopen: null, open: 100, close: 110 }],
      }),
    } as Response))
    vi.stubGlobal('fetch', fetchMock)

    const client = new MarketDataClient('/StockLab/data/')
    const series = await client.loadAssetMarketCapitalizationSeriesAtPath('market-cap/kr/K001.json')
    expect(series.bars[0].close).toBe(110)
    expect(fetchMock).toHaveBeenCalledWith('/StockLab/data/market-cap/kr/K001.json')
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
