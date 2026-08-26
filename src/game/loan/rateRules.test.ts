import { describe, expect, it } from 'vitest'
import bokBaseRateJson from '../../../public/data/rates/bok-base-rate.json'
import { parseBaseRateSeries } from '../../data/rateSchema'
import { getBaseRateForDate, getWsLoanAnnualRate, getWsOverdueAnnualRate } from './rateRules'

const series = parseBaseRateSeries(bokBaseRateJson)

describe('WS Bank rate rules', () => {
  it('applies official BOK changes on the effective date without lookahead', () => {
    const boundaries = [
      ['2018-11-29', 1.5, '2018-11-30', 1.75],
      ['2019-10-15', 1.5, '2019-10-16', 1.25],
      ['2020-03-16', 1.25, '2020-03-17', 0.75],
      ['2020-05-27', 0.75, '2020-05-28', 0.5],
      ['2022-07-12', 1.75, '2022-07-13', 2.25],
      ['2023-01-12', 3.25, '2023-01-13', 3.5],
      ['2024-10-10', 3.5, '2024-10-11', 3.25],
      ['2025-05-28', 2.75, '2025-05-29', 2.5],
      ['2026-07-15', 2.5, '2026-07-16', 2.75],
    ] as const

    for (const [beforeDate, beforeRate, effectiveDate, effectiveRate] of boundaries) {
      expect(getBaseRateForDate(series, beforeDate)).toBe(beforeRate)
      expect(getBaseRateForDate(series, effectiveDate)).toBe(effectiveRate)
    }
  })

  it('preserves the existing BOK base rate plus 3 percentage-point WS Bank spread', () => {
    expect(getWsLoanAnnualRate(series, '2018-01-01')).toBe(4.5)
    expect(getWsLoanAnnualRate(series, '2020-05-28')).toBe(3.5)
    expect(getWsLoanAnnualRate(series, '2022-07-13')).toBe(5.25)
    expect(getWsLoanAnnualRate(series, '2023-01-13')).toBe(6.5)
    expect(getWsLoanAnnualRate(series, '2026-08-25')).toBe(5.75)
    expect(getWsOverdueAnnualRate(series, '2026-08-25')).toBe(8.75)
  })

  it('rejects dates outside authoritative coverage', () => {
    expect(() => getBaseRateForDate(series, '2017-12-31')).toThrow(/범위/)
    expect(() => getBaseRateForDate(series, '2026-08-26')).toThrow(/범위/)
  })
})
