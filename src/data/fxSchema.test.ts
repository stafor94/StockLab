import { describe, expect, it } from 'vitest'
import { parseFxRateSeries } from './fxSchema'

const valid = {
  schemaVersion: 1,
  pair: 'USD/KRW',
  coverage: { from: '2017-12-29', to: '2018-01-02' },
  rates: [
    { date: '2017-12-29', usdKrw: 1071.4 },
    { date: '2018-01-02', usdKrw: 1071.4 },
  ],
  source: {
    provider: 'Bank of Korea ECOS',
    statCode: '731Y001',
    itemCode: '0000001',
    frequency: 'D',
    endpoint: 'https://ecos.bok.or.kr/api/StatisticSearch',
    generatedAt: '2026-08-26T00:00:00.000Z',
  },
}

describe('USD/KRW FX schema', () => {
  it('accepts the configured official ECOS series', () => {
    expect(parseFxRateSeries(valid).rates).toHaveLength(2)
  })

  it('rejects coverage metadata that does not match stored rows', () => {
    expect(() => parseFxRateSeries({ ...valid, coverage: { from: '2018-01-01', to: '2018-01-02' } })).toThrow(/coverage must match/)
  })

  it('rejects duplicate or unsorted rows', () => {
    expect(() => parseFxRateSeries({
      ...valid,
      rates: [valid.rates[0], valid.rates[0]],
      coverage: { from: '2017-12-29', to: '2017-12-29' },
    })).toThrow(/strictly ordered/)
  })

  it('rejects non-official source metadata', () => {
    expect(() => parseFxRateSeries({
      ...valid,
      source: { ...valid.source, statCode: 'WRONG' },
    })).toThrow(/source metadata/)
  })
})
