import { describe, expect, it } from 'vitest'
import {
  normalizeAlphaVantageDailyPayload,
  normalizeKrxDailyPayload,
  SourceDataError,
} from './normalizers'

describe('market source normalizers', () => {
  it('normalizes KRX unadjusted daily rows and skips zero-price suspended rows', () => {
    const rows = normalizeKrxDailyPayload({
      OutBlock_1: [
        {
          BAS_DD: '20180102',
          ISU_CD: '000001',
          TDD_OPNPRC: '10,000',
          TDD_HGPRC: '11,000',
          TDD_LWPRC: '9,500',
          TDD_CLSPRC: '10,500',
          ACC_TRDVOL: '1,234',
        },
        {
          BAS_DD: '20180102',
          ISU_CD: '000002',
          TDD_OPNPRC: '0',
          TDD_HGPRC: '0',
          TDD_LWPRC: '0',
          TDD_CLSPRC: '0',
          ACC_TRDVOL: '0',
        },
      ],
    })

    expect(rows).toEqual([
      {
        symbol: '000001',
        bar: {
          date: '2018-01-02',
          open: 10000,
          high: 11000,
          low: 9500,
          close: 10500,
          volume: 1234,
        },
      },
    ])
  })

  it('normalizes Alpha Vantage TIME_SERIES_DAILY raw OHLCV in ascending order', () => {
    const bars = normalizeAlphaVantageDailyPayload({
      'Time Series (Daily)': {
        '2018-01-03': {
          '1. open': '11.0',
          '2. high': '12.0',
          '3. low': '10.0',
          '4. close': '11.5',
          '5. volume': '200',
        },
        '2018-01-02': {
          '1. open': '10.0',
          '2. high': '11.0',
          '3. low': '9.0',
          '4. close': '10.5',
          '5. volume': '100',
        },
      },
    }, { from: '2018-01-01', to: '2018-01-03' })

    expect(bars.map((bar) => bar.date)).toEqual(['2018-01-02', '2018-01-03'])
    expect(bars[0].open).toBe(10)
  })

  it('fails fast on provider errors rather than treating them as price data', () => {
    expect(() => normalizeAlphaVantageDailyPayload({ Note: 'rate limit' }))
      .toThrow(SourceDataError)
  })
})
