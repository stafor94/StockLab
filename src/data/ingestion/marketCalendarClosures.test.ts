import { describe, expect, it } from 'vitest'
import type { MarketCalendar, MarketClosureDataset } from '../../types/market'
import {
  applyMarketClosureDataset,
  assertCompleteMarketCalendar,
  getUnclassifiedWeekdayClosures,
} from './marketCalendarClosures'

function calendar(overrides: Partial<MarketCalendar> = {}): MarketCalendar {
  return {
    schemaVersion: 1,
    market: 'KR',
    timeZone: 'Asia/Seoul',
    coverage: { from: '2018-01-01', to: '2018-01-08' },
    tradingDates: ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05', '2018-01-08'],
    closures: [],
    source: { authoritativeProvider: 'KRX KIND', mode: 'generated', generatedAt: null },
    ...overrides,
  }
}

function closureDataset(closures: MarketClosureDataset['closures']): MarketClosureDataset {
  return {
    schemaVersion: 1,
    market: 'KR',
    coverage: { from: '2018-01-01', to: '2018-12-31' },
    closures,
    source: {
      authoritativeProvider: 'KRX Market Closing(Holiday)',
      referenceUrl: 'https://global.krx.co.kr/',
      verifiedAt: '2026-08-27',
    },
  }
}

describe('market calendar closure metadata', () => {
  it('merges explicit weekday and weekend KRX closure reasons', () => {
    const merged = applyMarketClosureDataset(calendar(), closureDataset([
      { date: '2018-01-01', reason: '신정' },
      { date: '2018-01-06', reason: '주말 공휴일 테스트' },
    ]))

    expect(merged.closures).toEqual([
      { date: '2018-01-01', reason: '신정' },
      { date: '2018-01-06', reason: '주말 공휴일 테스트' },
    ])
  })

  it('rejects explicit closures that collide with official trading dates', () => {
    expect(() => applyMarketClosureDataset(calendar(), closureDataset([
      { date: '2018-01-02', reason: '잘못된 휴장일' },
    ]))).toThrow(/also a trading date/)
  })

  it('reports and rejects weekday gaps that have no explicit closure metadata', () => {
    const incomplete = calendar({
      tradingDates: ['2018-01-02', '2018-01-04', '2018-01-05', '2018-01-08'],
      closures: [{ date: '2018-01-01', reason: '신정' }],
    })

    expect(getUnclassifiedWeekdayClosures(incomplete)).toEqual(['2018-01-03'])
    expect(() => assertCompleteMarketCalendar(incomplete)).toThrow(/2018-01-03/)
  })

  it('accepts a calendar when every weekday is classified as trading or closed', () => {
    const complete = calendar({ closures: [{ date: '2018-01-01', reason: '신정' }] })
    expect(() => assertCompleteMarketCalendar(complete)).not.toThrow()
  })
})
