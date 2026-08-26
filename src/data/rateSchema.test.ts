import { describe, expect, it } from 'vitest'
import { parseBaseRateSeries } from './rateSchema'

function dataset(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    name: 'BOK_BASE_RATE',
    coverage: { from: '2018-01-01', to: '2018-12-31' },
    rates: [
      { date: '2017-11-30', annualRate: 1.5 },
      { date: '2018-11-30', annualRate: 1.75 },
    ],
    source: {
      provider: 'Bank of Korea',
      statCode: '722Y001',
      itemCode: '0101000',
      mode: 'ecos',
      generatedAt: 'test',
    },
    ...overrides,
  }
}

describe('BOK base-rate schema', () => {
  it('accepts an effective-date series with a carry-in row', () => {
    expect(parseBaseRateSeries(dataset()).rates).toHaveLength(2)
  })

  it('rejects invalid or inverted coverage', () => {
    expect(() => parseBaseRateSeries(dataset({ coverage: { from: '2018-13-01', to: '2018-12-31' } })))
      .toThrow('Invalid BOK base-rate coverage')
    expect(() => parseBaseRateSeries(dataset({ coverage: { from: '2018-12-31', to: '2018-01-01' } })))
      .toThrow('Invalid BOK base-rate coverage order')
  })

  it('requires a rate already in force at coverage start', () => {
    expect(() => parseBaseRateSeries(dataset({ rates: [{ date: '2018-01-02', annualRate: 1.5 }] })))
      .toThrow('BOK base-rate coverage requires a carry-in rate')
  })

  it('rejects no-op rows and future effective rows', () => {
    expect(() => parseBaseRateSeries(dataset({
      rates: [
        { date: '2017-11-30', annualRate: 1.5 },
        { date: '2018-01-02', annualRate: 1.5 },
      ],
    }))).toThrow('BOK base rates must contain effective changes only')

    expect(() => parseBaseRateSeries(dataset({
      rates: [
        { date: '2017-11-30', annualRate: 1.5 },
        { date: '2019-01-01', annualRate: 1.75 },
      ],
    }))).toThrow('BOK base rates must not contain future effective rows')
  })
})
