import { describe, expect, it } from 'vitest'
import type { DailyBar } from '../../types/market'
import { classifySplitAdjustment, unadjustSplitPrices, type EffectiveSplit } from './unadjustSplitPrices'

function bar(date: string, close: number, volume = 1_000_000): DailyBar {
  return { date, open: close, high: close, low: close, close, volume }
}

describe('Nasdaq split unadjustment', () => {
  it('restores a single forward split including historical share volume', () => {
    const result = unadjustSplitPrices([
      bar('2020-08-28', 124.8075, 187_629_920),
      bar('2020-08-31', 129.04, 225_702_700),
    ], [{ effectiveDate: '2020-08-31', numerator: 4, denominator: 1 }])
    expect(result[0].close).toBe(499.23)
    expect(result[0].volume).toBe(46_907_480)
    expect(result[1].close).toBe(129.04)
  })

  it('accumulates multiple split ratios across historical periods', () => {
    const splits: EffectiveSplit[] = [
      { effectiveDate: '2020-08-31', numerator: 5, denominator: 1 },
      { effectiveDate: '2022-08-25', numerator: 3, denominator: 1 },
    ]
    const result = unadjustSplitPrices([
      bar('2020-08-28', 147.56),
      bar('2021-01-04', 243.2567),
      bar('2022-08-25', 296.07),
    ], splits)
    expect(result[0].close).toBe(2213.4)
    expect(result[1].close).toBe(729.7701)
    expect(result[2].close).toBe(296.07)
  })

  it('restores reverse splits with the same general ratio rule', () => {
    const result = unadjustSplitPrices([
      bar('2024-04-30', 10, 10_000),
      bar('2024-05-01', 10.2, 1_200),
    ], [{ effectiveDate: '2024-05-01', numerator: 1, denominator: 10 }])
    expect(result[0].close).toBe(1)
    expect(result[0].volume).toBe(100_000)
  })

  it('detects adjusted versus already-raw price scale around an effective date', () => {
    const split = { effectiveDate: '2020-08-31', numerator: 4, denominator: 1 }
    expect(classifySplitAdjustment([bar('2020-08-28', 124.8075), bar('2020-08-31', 127.58)], split)).toBe('adjusted')
    expect(classifySplitAdjustment([bar('2020-08-28', 499.23), bar('2020-08-31', 127.58)], split)).toBe('unadjusted')
  })

  it('keeps masked regression anchors for verified split cases', () => {
    const anchors = [
      { name: 'U007 2020-08-28', adjusted: 124.8075, splits: [{ effectiveDate: '2020-08-31', numerator: 4, denominator: 1 }], raw: 499.23 },
      { name: 'U009 2020-08-28', adjusted: 147.56, splits: [{ effectiveDate: '2020-08-31', numerator: 5, denominator: 1 }, { effectiveDate: '2022-08-25', numerator: 3, denominator: 1 }], raw: 2213.4 },
      { name: 'U009 2022-08-24', adjusted: 297.09666667, splits: [{ effectiveDate: '2022-08-25', numerator: 3, denominator: 1 }], raw: 891.29000001 },
      { name: 'U001 2021-07-19', adjusted: 18.77975, splits: [{ effectiveDate: '2021-07-20', numerator: 4, denominator: 1 }, { effectiveDate: '2024-06-10', numerator: 10, denominator: 1 }], raw: 751.19 },
      { name: 'U001 2024-06-07', adjusted: 120.888, splits: [{ effectiveDate: '2024-06-10', numerator: 10, denominator: 1 }], raw: 1208.88 },
      { name: 'U032 2022-06-03', adjusted: 122.35, splits: [{ effectiveDate: '2022-06-06', numerator: 20, denominator: 1 }], raw: 2447 },
      { name: 'share-class-C 2022-07-15', adjusted: 112.77, splits: [{ effectiveDate: '2022-07-18', numerator: 20, denominator: 1 }], raw: 2255.4 },
      { name: 'U006 2022-07-15', adjusted: 111.7775, splits: [{ effectiveDate: '2022-07-18', numerator: 20, denominator: 1 }], raw: 2235.55 },
    ]
    for (const anchor of anchors) {
      const result = unadjustSplitPrices([bar(anchor.splits[0].effectiveDate > anchor.name.slice(-10) ? anchor.name.slice(-10) : '2020-01-01', anchor.adjusted)], anchor.splits)
      expect(result[0].close, anchor.name).toBeCloseTo(anchor.raw, 6)
    }
  })
})
