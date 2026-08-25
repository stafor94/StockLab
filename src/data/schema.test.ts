import { describe, expect, it } from 'vitest'
import { DataSchemaError, parseMarketCalendar, parseMarketDataManifest } from './schema'

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

  it('rejects an invalid market manifest', () => {
    expect(() => parseMarketDataManifest({
      schemaVersion: 1,
      calendars: { KR: 'calendars/kr.json' },
      assets: [],
    })).toThrow(DataSchemaError)
  })
})
