import { describe, expect, it } from 'vitest'
import { DataSchemaError, parseAssetMarketCapitalizationSeries, parseMarketCalendar, parseMarketDataManifest } from './schema'

describe('market data schemas', () => {
  it('normalizes duplicated and unsorted trading dates', () => {
    const calendar = parseMarketCalendar({
      schemaVersion: 1,
      market: 'KR',
      timeZone: 'Asia/Seoul',
      coverage: { from: '2018-01-01', to: '2018-01-03' },
      tradingDates: ['2018-01-03', '2018-01-02', '2018-01-02'],
      closures: [],
      source: { authoritativeProvider: 'KRX', mode: 'bootstrap-seed', generatedAt: null },
    })

    expect(calendar.tradingDates).toEqual(['2018-01-02', '2018-01-03'])
  })

  it('parses point-in-time market-cap bars with nullable unavailable values', () => {
    const series = parseAssetMarketCapitalizationSeries({
      schemaVersion: 1,
      id: 'U001',
      market: 'US',
      currency: 'USD',
      source: { authoritativeProvider: 'Nasdaq Historical Quotes + SEC EDGAR', methodology: 'fixture', generatedAt: '2026-08-28T00:00:00.000Z' },
      bars: [{ date: '2018-01-02', preopen: null, open: null, close: 100 }],
    })
    expect(series.bars[0].close).toBe(100)
    expect(series.bars[0].open).toBeNull()
  })

  it('rejects an invalid market manifest', () => {
    expect(() => parseMarketDataManifest({
      schemaVersion: 1,
      calendars: { KR: 'calendars/kr.json' },
      assets: [],
    })).toThrow(DataSchemaError)
  })
})
