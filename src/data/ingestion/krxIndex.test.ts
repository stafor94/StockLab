import { describe, expect, it } from 'vitest'
import { KrxIndexDataError, normalizeKrxIndexPayload } from './krxIndex'

describe('normalizeKrxIndexPayload', () => {
  it('normalizes official KRX Data Marketplace index rows into ordered daily bars', () => {
    expect(normalizeKrxIndexPayload({ output: [
      { TRD_DD: '2018/01/03', OPNPRC_IDX: '2,525.38', HGPRC_IDX: '2,525.38', LWPRC_IDX: '2,493.35', CLSPRC_IDX: '2,486.35', ACC_TRDVOL: '308,989,000' },
      { TRD_DD: '2018/01/02', OPNPRC_IDX: '2,474.86', HGPRC_IDX: '2,481.02', LWPRC_IDX: '2,465.94', CLSPRC_IDX: '2,479.65', ACC_TRDVOL: '262,187,000' },
    ] })).toEqual([
      { date: '2018-01-02', open: 2474.86, high: 2481.02, low: 2465.94, close: 2479.65, volume: 262187000 },
      { date: '2018-01-03', open: 2525.38, high: 2525.38, low: 2493.35, close: 2486.35, volume: 308989000 },
    ])
  })

  it('rejects malformed provider rows rather than inventing index values', () => {
    expect(() => normalizeKrxIndexPayload({ output: [
      { TRD_DD: '2018/01/02', OPNPRC_IDX: '-', HGPRC_IDX: '1', LWPRC_IDX: '1', CLSPRC_IDX: '1', ACC_TRDVOL: '-' },
    ] })).toThrow(KrxIndexDataError)
  })
})
