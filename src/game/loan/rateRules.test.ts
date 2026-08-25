import { describe, expect, it } from 'vitest'
import type { BaseRateSeries } from '../../types/rates'
import { getBaseRateForDate, getWsLoanAnnualRate, getWsOverdueAnnualRate } from './rateRules'

const series: BaseRateSeries = {
  schemaVersion: 1,
  name: 'BOK_BASE_RATE',
  coverage: { from: '2018-01-01', to: '2018-12-31' },
  rates: [{ date: '2017-11-30', annualRate: 1.5 }, { date: '2018-11-30', annualRate: 1.75 }],
  source: { provider: 'Bank of Korea', statCode: '722Y001', itemCode: '0101000', mode: 'bootstrap', generatedAt: 'test' },
}

describe('WS Bank rate rules', () => {
  it('uses the latest BOK rate without lookahead', () => {
    expect(getBaseRateForDate(series, '2018-11-29')).toBe(1.5)
    expect(getBaseRateForDate(series, '2018-11-30')).toBe(1.75)
    expect(getWsLoanAnnualRate(series, '2018-11-30')).toBe(4.75)
    expect(getWsOverdueAnnualRate(series, '2018-11-30')).toBe(7.75)
  })

  it('rejects dates outside authoritative coverage', () => {
    expect(() => getBaseRateForDate(series, '2019-01-01')).toThrow(/범위/)
  })
})
