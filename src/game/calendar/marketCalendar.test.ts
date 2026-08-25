import { describe, expect, it } from 'vitest'
import {
  advanceGameDate,
  getNextGameDate,
  getOpenMarketsOnDate,
} from './marketCalendar'
import type { MarketCalendar, MarketCalendars, MarketCode } from '../../types/market'

function calendar(market: MarketCode, tradingDates: string[]): MarketCalendar {
  return {
    schemaVersion: 1,
    market,
    timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
    coverage: { from: '2018-01-01', to: '2018-02-02' },
    tradingDates,
    closures: [],
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

  it('supports week and month jumps without landing on a joint closure', () => {
    expect(advanceGameDate('2018-01-01', 'week', calendars)).toBe('2018-01-08')
    expect(advanceGameDate('2018-01-01', 'month', calendars)).toBe('2018-02-01')
  })

  it('returns null after the available calendar range', () => {
    expect(advanceGameDate('2018-02-01', 'day', calendars)).toBeNull()
  })
})
