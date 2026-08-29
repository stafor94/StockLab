import { describe, expect, it } from 'vitest'
import { alignSharesToPriceDate, buildDailyMarketCapBar } from './marketCapShares'

describe('alignSharesToPriceDate', () => {
  const split = [{ effectiveDate: '2020-08-31', numerator: 4, denominator: 1 }]

  it('moves pre-split shares forward to a post-split price date', () => {
    expect(alignSharesToPriceDate(100, '2020-08-28', '2020-08-31', split)).toBe(400)
  })

  it('moves post-split shares backward to a pre-split close used at pre-open', () => {
    expect(alignSharesToPriceDate(400, '2020-08-31', '2020-08-28', split)).toBe(100)
  })
})

describe('buildDailyMarketCapBar', () => {
  it('carries the previous market-cap close into preopen when new shares apply today', () => {
    const previousClose = 1_000
    const bar = buildDailyMarketCapBar(
      { date: '2026-08-28', open: 10, close: 11 },
      200,
      previousClose,
    )

    expect(bar).toEqual({
      date: '2026-08-28',
      preopen: previousClose,
      open: 2_000,
      close: 2_200,
    })
  })

  it('stores derived market caps as rounded positive safe integers', () => {
    const bar = buildDailyMarketCapBar(
      { date: '2026-08-28', open: 10.125, close: 11.375 },
      3,
      null,
    )
    expect(bar).toEqual({ date: '2026-08-28', preopen: null, open: 30, close: 34 })
    expect(Number.isSafeInteger(bar.open)).toBe(true)
    expect(Number.isSafeInteger(bar.close)).toBe(true)
  })

  it('rejects derived values outside the safe-integer range', () => {
    expect(() => buildDailyMarketCapBar(
      { date: '2026-08-28', open: Number.MAX_SAFE_INTEGER, close: Number.MAX_SAFE_INTEGER },
      2,
      null,
    )).toThrow(/safe-integer/)
  })
})
