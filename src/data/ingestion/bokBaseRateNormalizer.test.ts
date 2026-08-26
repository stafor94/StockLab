import { describe, expect, it } from 'vitest'
import { normalizeBokEcosBaseRates } from './bokBaseRateNormalizer'

const officialRow = {
  STAT_CODE: '722Y001',
  ITEM_CODE1: '0101000',
  ITEM_NAME1: '한국은행 기준금리',
}

describe('BOK ECOS base-rate normalizer', () => {
  it('orders rows and compresses unchanged daily rates into change points', () => {
    const result = normalizeBokEcosBaseRates({
      StatisticSearch: {
        row: [
          { ...officialRow, TIME: '20181203', DATA_VALUE: '1.75' },
          { ...officialRow, TIME: '20181129', DATA_VALUE: '1.50' },
          { ...officialRow, TIME: '20181130', DATA_VALUE: '1.75' },
          { ...officialRow, TIME: '20181204', DATA_VALUE: '1.75' },
        ],
      },
    })
    expect(result).toEqual([
      { date: '2018-11-29', annualRate: 1.5 },
      { date: '2018-11-30', annualRate: 1.75 },
    ])
  })

  it('rejects rows from a different ECOS series', () => {
    expect(() => normalizeBokEcosBaseRates({
      StatisticSearch: {
        row: [{ ...officialRow, STAT_CODE: '999Y999', TIME: '20181130', DATA_VALUE: '1.75' }],
      },
    })).toThrow('Unexpected BOK ECOS stat code')
  })

  it('rejects conflicting values for the same effective date', () => {
    expect(() => normalizeBokEcosBaseRates({
      StatisticSearch: {
        row: [
          { ...officialRow, TIME: '20181130', DATA_VALUE: '1.50' },
          { ...officialRow, TIME: '20181130', DATA_VALUE: '1.75' },
        ],
      },
    })).toThrow('Conflicting BOK ECOS base-rate values on 2018-11-30')
  })

  it('rejects impossible dates and implausible annual rates', () => {
    expect(() => normalizeBokEcosBaseRates({
      StatisticSearch: { row: [{ ...officialRow, TIME: '20260230', DATA_VALUE: '2.75' }] },
    })).toThrow('Invalid ECOS date')
    expect(() => normalizeBokEcosBaseRates({
      StatisticSearch: { row: [{ ...officialRow, TIME: '20260228', DATA_VALUE: '31' }] },
    })).toThrow('Invalid BOK ECOS base-rate value')
  })
})
