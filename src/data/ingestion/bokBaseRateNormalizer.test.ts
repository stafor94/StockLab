import { describe, expect, it } from 'vitest'
import { normalizeBokEcosBaseRates } from './bokBaseRateNormalizer'

describe('BOK ECOS base-rate normalizer', () => {
  it('orders rows and compresses unchanged daily rates into change points', () => {
    const result = normalizeBokEcosBaseRates({
      StatisticSearch: {
        row: [
          { TIME: '20181203', DATA_VALUE: '1.75' },
          { TIME: '20181129', DATA_VALUE: '1.50' },
          { TIME: '20181130', DATA_VALUE: '1.75' },
          { TIME: '20181204', DATA_VALUE: '1.75' },
        ],
      },
    })
    expect(result).toEqual([
      { date: '2018-11-29', annualRate: 1.5 },
      { date: '2018-11-30', annualRate: 1.75 },
    ])
  })
})
