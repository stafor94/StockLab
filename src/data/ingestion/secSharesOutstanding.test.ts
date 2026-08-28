import { describe, expect, it } from 'vitest'
import { normalizeSecSharesOutstandingCompanyFacts, selectSecSharesAvailableBefore } from './secSharesOutstanding'

describe('SEC shares outstanding normalization', () => {
  it('uses only filings available before the simulated trading day', () => {
    const snapshots = normalizeSecSharesOutstandingCompanyFacts({ facts: { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
      { end: '2018-01-20', filed: '2018-01-25', form: '10-Q', val: 100 },
      { end: '2018-04-20', filed: '2018-04-25', form: '10-Q', val: 120 },
    ] } } } } })
    expect(selectSecSharesAvailableBefore(snapshots, '2018-04-25')?.sharesOutstanding).toBe(100)
    expect(selectSecSharesAvailableBefore(snapshots, '2018-04-26')?.sharesOutstanding).toBe(120)
  })
})
