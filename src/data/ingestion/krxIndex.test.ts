import { describe, expect, it } from 'vitest'
import { KrxIndexDataError, normalizeKrxIndexDailyPayload } from './krxIndex'

const officialDailyPayload = {
  block1: [
    { ind_tp_cd: '1', idx_ind_cd: '001', idx_nm: '(유) 코스피 (외국주포함)', clsprc_idx: '-', opnprc_idx: '-', hgprc_idx: '-', lwprc_idx: '-', acc_trdvol: '262,205' },
    { ind_tp_cd: 'Z', idx_ind_cd: '001', idx_nm: '(유) 코스피', clsprc_idx: '2,479.65', opnprc_idx: '2,474.86', hgprc_idx: '2,481.02', lwprc_idx: '2,465.94', acc_trdvol: '262,121' },
    { ind_tp_cd: '2', idx_ind_cd: '001', idx_nm: '(코) 코스닥 (외국주포함)', clsprc_idx: '-', opnprc_idx: '-', hgprc_idx: '-', lwprc_idx: '-', acc_trdvol: '989,204' },
    { ind_tp_cd: 'Z', idx_ind_cd: '002', idx_nm: '(코) 코스닥지수', clsprc_idx: '812.45', opnprc_idx: '803.63', hgprc_idx: '813.40', lwprc_idx: '800.54', acc_trdvol: '909,282' },
  ],
}

describe('normalizeKrxIndexDailyPayload', () => {
  it('selects the official KOSPI representative row rather than the foreign-share aggregate row', () => {
    expect(normalizeKrxIndexDailyPayload(officialDailyPayload, { date: '2018-01-02', target: 'KOSPI' })).toEqual({
      date: '2018-01-02', open: 2474.86, high: 2481.02, low: 2465.94, close: 2479.65, volume: null,
    })
  })

  it('selects the official KOSDAQ representative row from the same KRX daily response', () => {
    expect(normalizeKrxIndexDailyPayload(officialDailyPayload, { date: '2018-01-02', target: 'KOSDAQ' })).toEqual({
      date: '2018-01-02', open: 803.63, high: 813.4, low: 800.54, close: 812.45, volume: null,
    })
  })

  it('returns null for a missing or fully unavailable representative row', () => {
    expect(normalizeKrxIndexDailyPayload({ block1: [] }, { date: '2018-01-01', target: 'KOSPI' })).toBeNull()
    expect(normalizeKrxIndexDailyPayload({ block1: [
      { ind_tp_cd: 'Z', idx_ind_cd: '001', idx_nm: '(유) 코스피', clsprc_idx: '-', opnprc_idx: '-', hgprc_idx: '-', lwprc_idx: '-' },
    ] }, { date: '2018-01-01', target: 'KOSPI' })).toBeNull()
  })

  it('rejects incomplete official OHLC rather than inventing values', () => {
    expect(() => normalizeKrxIndexDailyPayload({ block1: [
      { ind_tp_cd: 'Z', idx_ind_cd: '001', idx_nm: '(유) 코스피', clsprc_idx: '2,479.65', opnprc_idx: '-', hgprc_idx: '2,481.02', lwprc_idx: '2,465.94' },
    ] }, { date: '2018-01-02', target: 'KOSPI' })).toThrow(KrxIndexDataError)
  })
})
