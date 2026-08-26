import { describe, expect, it } from 'vitest'
import { KrxIndexDataError, normalizeKrxIndexHistoryPayload } from './krxIndex'

const officialHistoryPayload = {
  output: [
    { TRD_DD: '2018/01/03', CLSPRC_IDX: '2,486.35', OPNPRC_IDX: '2,484.63', HGPRC_IDX: '2,493.40', LWPRC_IDX: '2,481.91', ACC_TRDVOL: '322,700' },
    { TRD_DD: '2018/01/02', CLSPRC_IDX: '2,479.65', OPNPRC_IDX: '2,474.86', HGPRC_IDX: '2,481.02', LWPRC_IDX: '2,465.94', ACC_TRDVOL: '262,121' },
  ],
}

describe('normalizeKrxIndexHistoryPayload', () => {
  it('normalizes official KRX date-range OHLC and sorts ascending', () => {
    expect(normalizeKrxIndexHistoryPayload(officialHistoryPayload, { target: 'KOSPI' })).toEqual([
      { date: '2018-01-02', open: 2474.86, high: 2481.02, low: 2465.94, close: 2479.65, volume: 262121 },
      { date: '2018-01-03', open: 2484.63, high: 2493.4, low: 2481.91, close: 2486.35, volume: 322700 },
    ])
  })

  it('preserves an unavailable official volume as null without inventing it', () => {
    expect(normalizeKrxIndexHistoryPayload({ output: [
      { TRD_DD: '2018/01/02', CLSPRC_IDX: '812.45', OPNPRC_IDX: '803.63', HGPRC_IDX: '813.40', LWPRC_IDX: '800.54', ACC_TRDVOL: '-' },
    ] }, { target: 'KOSDAQ' })).toEqual([
      { date: '2018-01-02', open: 803.63, high: 813.4, low: 800.54, close: 812.45, volume: null },
    ])
  })

  it('rejects incomplete official OHLC rather than inventing values', () => {
    expect(() => normalizeKrxIndexHistoryPayload({ output: [
      { TRD_DD: '2018/01/02', CLSPRC_IDX: '2,479.65', OPNPRC_IDX: '-', HGPRC_IDX: '2,481.02', LWPRC_IDX: '2,465.94' },
    ] }, { target: 'KOSPI' })).toThrow(KrxIndexDataError)
  })

  it('rejects conflicting duplicate dates', () => {
    expect(() => normalizeKrxIndexHistoryPayload({ output: [
      { TRD_DD: '2018/01/02', CLSPRC_IDX: '2,479.65', OPNPRC_IDX: '2,474.86', HGPRC_IDX: '2,481.02', LWPRC_IDX: '2,465.94', ACC_TRDVOL: '262,121' },
      { TRD_DD: '2018/01/02', CLSPRC_IDX: '2,480.00', OPNPRC_IDX: '2,474.86', HGPRC_IDX: '2,481.02', LWPRC_IDX: '2,465.94', ACC_TRDVOL: '262,121' },
    ] }, { target: 'KOSPI' })).toThrow(/conflicting duplicate/)
  })
})
