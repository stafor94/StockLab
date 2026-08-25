import { describe, expect, it } from 'vitest'
import { normalizeBokEcosUsdKrw } from './bokFxNormalizer'

describe('BOK ECOS USD/KRW normalizer', () => {
  it('normalizes daily reference rates and orders them by date', () => {
    const rates = normalizeBokEcosUsdKrw({ StatisticSearch: { row: [
      { TIME: '20180103', DATA_VALUE: '1,064.50' },
      { TIME: '20180102', DATA_VALUE: '1061.20' },
    ] } })
    expect(rates).toEqual([
      { date: '2018-01-02', usdKrw: 1061.2 },
      { date: '2018-01-03', usdKrw: 1064.5 },
    ])
  })
})
