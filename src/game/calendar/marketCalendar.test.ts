import { describe, expect, it } from 'vitest'
import {
  advanceGameDate,
  getMarketClosureReason,
  getNextGameDate,
  getOpenMarketsOnDate,
} from './marketCalendar'
import type { CalendarClosure, MarketCalendar, MarketCalendars, MarketCode } from '../../types/market'

function calendar(
  market: MarketCode,
  tradingDates: string[],
  closures: CalendarClosure[] = [],
): MarketCalendar {
  return {
    schemaVersion: 1,
    market,
    timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
    coverage: { from: '2018-01-01', to: '2018-02-02' },
    tradingDates,
    closures,
    source: {
      authoritativeProvider: market === 'KR' ? 'KRX' : 'Alpha Vantage',
      mode: 'bootstrap-seed',
      generatedAt: null,
    },
  }
}

const calendars: MarketCalendars = {
  KR: calendar('KR', ['2018-01-02', '2018-01-08', '2018-01-15', '2018-02-01']),
  US: calendar('US', ['2018-01-02', '2018-01-08', '2018-01-16', '2018-02-01']),
}

describe('market calendar engine', () => {
  it('advances to the next date where at least one market is open', () => {
    expect(getNextGameDate('2018-01-01', calendars)).toBe('2018-01-02')
    expect(getNextGameDate('2018-01-08', calendars)).toBe('2018-01-15')
  })

  it('reports independently open markets', () => {
    expect(getOpenMarketsOnDate('2018-01-15', calendars)).toEqual(['KR'])
    expect(getOpenMarketsOnDate('2018-01-16', calendars)).toEqual(['US'])
  })

  it('infers weekday closures from authoritative trading dates', () => {
    const kr = calendar('KR', ['2018-01-02', '2018-01-04'])
    expect(getMarketClosureReason('2018-01-03', kr)).toBe('공휴일 또는 거래소 지정 휴장일')
    expect(getMarketClosureReason('2018-01-02', kr)).toBeNull()
    expect(getMarketClosureReason('2018-01-06', kr)).toBeNull()
    expect(getMarketClosureReason('2018-02-05', kr)).toBeNull()
  })

  it('prefers an explicit closure reason when calendar metadata provides one', () => {
    const us = calendar('US', ['2018-01-02'], [
      { date: '2018-01-15', reason: 'Martin Luther King Jr. Day' },
    ])
    expect(getMarketClosureReason('2018-01-15', us)).toBe('Martin Luther King Jr. Day')
  })

  it('supports week and month jumps without landing on a joint closure', () => {
    expect(advanceGameDate('2018-01-01', 'week', calendars)).toBe('2018-01-08')
    expect(advanceGameDate('2018-01-01', 'month', calendars)).toBe('2018-02-01')
  })

  it('returns null after the available calendar range', () => {
    expect(advanceGameDate('2018-02-01', 'day', calendars)).toBeNull()
  })
})
