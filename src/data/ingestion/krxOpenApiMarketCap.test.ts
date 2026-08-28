import { describe, expect, it } from 'vitest'
import { normalizeKrxOpenApiMarketCapPayload } from './krxOpenApiMarketCap'

describe('normalizeKrxOpenApiMarketCapPayload', () => {
  it('normalizes official market-cap and listed-share fields', () => {
    const rows = normalizeKrxOpenApiMarketCapPayload({ OutBlock_1: [{
      BAS_DD: '20190805', ISU_SRT_CD: '005930', ISU_NM: '삼성전자',
      TDD_OPNPRC: '44,350', TDD_CLSPRC: '43,950', MKTCAP: '262,370,000,000,000', LIST_SHRS: '5,969,782,550',
    }] }, '2019-08-05', new Set(['005930']))
    expect(rows).toEqual([{ date: '2019-08-05', symbol: '005930', name: '삼성전자', open: 44350, close: 43950, marketCap: 262370000000000, listedShares: 5969782550 }])
  })
})
