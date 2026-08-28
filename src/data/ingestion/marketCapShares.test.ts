import { describe, expect, it } from 'vitest'
import { alignSharesToPriceDate } from './marketCapShares'

describe('alignSharesToPriceDate', () => {
  const split = [{ effectiveDate: '2020-08-31', numerator: 4, denominator: 1 }]

  it('moves pre-split shares forward to a post-split price date', () => {
    expect(alignSharesToPriceDate(100, '2020-08-28', '2020-08-31', split)).toBe(400)
  })

  it('moves post-split shares backward to a pre-split close used at pre-open', () => {
    expect(alignSharesToPriceDate(400, '2020-08-31', '2020-08-28', split)).toBe(100)
  })
})
