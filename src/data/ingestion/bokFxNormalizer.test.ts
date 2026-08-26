import { describe, expect, it } from 'vitest'
import { normalizeBokEcosUsdKrw } from './bokFxNormalizer'

function row(time: string, dataValue: string, overrides: Record<string, unknown> = {}) {
  return {
    STAT_CODE: '731Y001',
    ITEM_CODE1: '0000001',
    TIME: time,
    DATA_VALUE: dataValue,
    ...overrides,
  }
}

describe('BOK ECOS USD/KRW normalizer', () => {
  it('normalizes official daily reference rates and orders them by date', () => {
    const rates = normalizeBokEcosUsdKrw({ StatisticSearch: { row: [
      row('20180103', '1,064.30'),
      row('20180102', '1071.40'),
    ] } })
    expect(rates).toEqual([
      { date: '2018-01-02', usdKrw: 1071.4 },
      { date: '2018-01-03', usdKrw: 1064.3 },
    ])
  })

  it('rejects rows from a different ECOS statistic or item', () => {
    expect(() => normalizeBokEcosUsdKrw({ StatisticSearch: { row: [
      row('20180102', '1071.40', { ITEM_CODE1: '9999999' }),
    ] } })).toThrow(/configured USD\/KRW series/)
  })

  it('rejects duplicate dates instead of silently overwriting them', () => {
    expect(() => normalizeBokEcosUsdKrw({ StatisticSearch: { row: [
      row('20180102', '1071.40'),
      row('20180102', '1072.00'),
    ] } })).toThrow(/duplicate date/)
  })
})
