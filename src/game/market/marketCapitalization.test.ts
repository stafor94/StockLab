import { describe, expect, it } from 'vitest'
import type { AssetManifestItem, AssetMarketCapitalizationSeries } from '../../types/market'
import { rankAssetsByMarketCapitalization, selectMarketCapitalization } from './marketCapitalization'

const series: AssetMarketCapitalizationSeries = {
  schemaVersion: 1,
  id: 'K001',
  market: 'KR',
  currency: 'KRW',
  source: { authoritativeProvider: 'KRX OPEN API', methodology: 'fixture', generatedAt: '2026-08-28T00:00:00.000Z' },
  bars: [
    { date: '2018-01-02', preopen: null, open: 90, close: 100 },
    { date: '2018-01-03', preopen: 100, open: 110, close: 120 },
  ],
}

const asset = (id: string, market: 'KR' | 'US', currency: 'KRW' | 'USD'): AssetManifestItem => ({
  id,
  alias: id,
  kind: 'stock',
  market,
  currency,
  sector: 'test',
  listedFrom: '2018-01-01',
  dataPath: `${id}.json`,
  marketCapPath: `market-cap/${id}.json`,
})

describe('historical market capitalization', () => {
  it('respects the market information boundary by session phase', () => {
    expect(selectMarketCapitalization(series, '2018-01-03', { phase: 'preopen', tradingDate: null })?.value).toBe(100)
    expect(selectMarketCapitalization(series, '2018-01-03', { phase: 'opened', tradingDate: '2018-01-03' })?.value).toBe(110)
    expect(selectMarketCapitalization(series, '2018-01-03', { phase: 'closed', tradingDate: '2018-01-03' })?.value).toBe(120)
  })

  it('ranks mixed markets in KRW using the point-in-time BOK reference rate', () => {
    const kr = asset('K001', 'KR', 'KRW')
    const us = asset('U001', 'US', 'USD')
    const missing = asset('U002', 'US', 'USD')
    const ranked = rankAssetsByMarketCapitalization([kr, us, missing], {
      K001: { value: 1_000, currency: 'KRW', valueDate: '2018-01-02', source: 'today-close' },
      U001: { value: 2, currency: 'USD', valueDate: '2018-01-02', source: 'today-close' },
      U002: null,
    }, 600)
    expect(ranked.map((item) => item.id)).toEqual(['U001', 'K001', 'U002'])
  })
})
