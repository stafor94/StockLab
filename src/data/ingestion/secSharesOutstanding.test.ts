import { describe, expect, it } from 'vitest'
import { normalizeSecSharesOutstandingCompanyFacts, selectSecSharesAvailableBefore } from './secSharesOutstanding'

describe('SEC shares outstanding normalization', () => {
  it('uses only filings available before the simulated trading day', () => {
    const snapshots = normalizeSecSharesOutstandingCompanyFacts({ facts: { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
      { end: '2018-01-20', filed: '2018-01-25', form: '10-Q', accn: '0001', val: 100 },
      { end: '2018-04-20', filed: '2018-04-25', form: '10-Q', accn: '0002', val: 120 },
    ] } } } } })
    expect(selectSecSharesAvailableBefore(snapshots, '2018-04-25')?.sharesOutstanding).toBe(100)
    expect(selectSecSharesAvailableBefore(snapshots, '2018-04-26')?.sharesOutstanding).toBe(120)
  })

  it('aggregates class-specific DEI cover facts from the same filing', () => {
    const snapshots = normalizeSecSharesOutstandingCompanyFacts({ facts: {
      dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
        { end: '2019-04-18', filed: '2019-04-25', form: '10-Q', accn: '0003', val: 100 },
        { end: '2019-04-18', filed: '2019-04-25', form: '10-Q', accn: '0003', val: 20 },
        { end: '2019-04-18', filed: '2019-04-25', form: '10-Q', accn: '0003', val: 110 },
      ] } } },
      'us-gaap': { CommonStockSharesOutstanding: { units: { shares: [
        { end: '2019-03-31', filed: '2019-04-25', form: '10-Q', accn: '0003', val: 999 },
      ] } } },
    } })
    expect(snapshots).toEqual([
      { asOfDate: '2019-04-18', availableFrom: '2019-04-25', sharesOutstanding: 230, form: '10-Q' },
    ])
  })

  it('falls back to the largest period-end GAAP fact when cover facts are unavailable', () => {
    const snapshots = normalizeSecSharesOutstandingCompanyFacts({ facts: {
      'us-gaap': { CommonStockSharesOutstanding: { units: { shares: [
        { end: '2019-03-31', filed: '2019-04-25', form: '10-Q', accn: '0004', val: 80 },
        { end: '2019-03-31', filed: '2019-04-25', form: '10-Q', accn: '0004', val: 100 },
      ] } } },
    } })
    expect(snapshots[0]?.sharesOutstanding).toBe(100)
  })
})