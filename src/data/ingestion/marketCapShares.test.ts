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
})
