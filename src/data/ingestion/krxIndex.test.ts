import { describe, expect, it } from 'vitest'
import { KrxIndexDataError, normalizeKrxIndexPayload } from './krxIndex'

describe('normalizeKrxIndexPayload', () => {
  it('selects and normalizes the requested official KRX index row', () => {
    expect(normalizeKrxIndexPayload({ OutBlock_1: [
      { BAS_DD: '20180102', IDX_NM: '코스피 200', OPNPRC_IDX: '330.00', HGPRC_IDX: '331.00', LWPRC_IDX: '329.00', CLSPRC_IDX: '330.50', ACC_TRDVOL: '100,000' },
      { BAS_DD: '20180102', IDX_NM: '코스피', OPNPRC_IDX: '2,474.86', HGPRC_IDX: '2,481.02', LWPRC_IDX: '2,465.94', CLSPRC_IDX: '2,479.65', ACC_TRDVOL: '262,187,000' },
    ] }, '코스피')).toEqual([
      { date: '2018-01-02', open: 2474.86, high: 2481.02, low: 2465.94, close: 2479.65, volume: 262187000 },
    ])
  })

  it('returns no bar when an official response has no requested index row', () => {
    expect(normalizeKrxIndexPayload({ OutBlock_1: [] }, '코스닥')).toEqual([])
  })

  it('rejects malformed provider rows rather than inventing index values', () => {
    expect(() => normalizeKrxIndexPayload({ OutBlock_1: [
      { BAS_DD: '20180102', IDX_NM: '코스피', OPNPRC_IDX: '-', HGPRC_IDX: '1', LWPRC_IDX: '1', CLSPRC_IDX: '1', ACC_TRDVOL: '-' },
    ] }, '코스피')).toThrow(KrxIndexDataError)
  })
})
