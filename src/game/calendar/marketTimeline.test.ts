import { describe, expect, it } from 'vitest'
import type { MarketCalendar, MarketCalendars, MarketCode } from '../../types/market'
import {
  advanceGameTimestamp,
  applyMarketEventToSessions,
  applyMarketEventsToSessions,
  createInitialMarketSessions,
  formatKstGameDate,
  getKstGameDate,
  getKstGameTime,
  getMarketEventsBetween,
  getNextMarketEvent,
} from './marketTimeline'

function calendar(market: MarketCode, tradingDates: string[]): MarketCalendar {
  return {
    schemaVersion: 1,
    market,
    timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
    coverage: { from: '2026-01-01', to: '2026-12-31' },
    tradingDates,
    closures: [],
    source: {
      authoritativeProvider: market === 'KR' ? 'KRX' : 'Nasdaq',
      mode: 'generated',
      generatedAt: null,
    },
  }
}

function calendars(krDates: string[], usDates: string[]): MarketCalendars {
  return { KR: calendar('KR', krDates), US: calendar('US', usDates) }
}

describe('market timeline', () => {
  it('orders a normal weekday as KRX open, KRX close, US open, US close', () => {
    const source = calendars(['2026-08-27'], ['2026-08-27'])
    const events = getMarketEventsBetween('2026-08-26T15:00:00.000Z', '2026-08-28T00:00:00.000Z', source)

    expect(events.map((event) => `${event.market}:${event.type}`)).toEqual([
      'KR:OPEN',
      'KR:CLOSE',
      'US:OPEN',
      'US:CLOSE',
    ])
    expect(events.map((event) => event.timestamp)).toEqual([
      '2026-08-27T00:00:00.000Z',
      '2026-08-27T06:30:00.000Z',
      '2026-08-27T13:30:00.000Z',
      '2026-08-27T20:00:00.000Z',
    ])
    expect(getKstGameTime(events[0].displayTimestamp)).toBe('09:00')
    expect(getKstGameTime(events[1].displayTimestamp)).toBe('15:29')
  })

  it('uses America/New_York DST rules for US summer session times', () => {
    const source = calendars([], ['2026-08-27'])
    const events = getMarketEventsBetween('2026-08-27T00:00:00.000Z', '2026-08-28T00:00:00.000Z', source)

    expect(events[0]).toMatchObject({ market: 'US', type: 'OPEN', tradingDate: '2026-08-27', timestamp: '2026-08-27T13:30:00.000Z' })
    expect(getKstGameTime(events[0].displayTimestamp)).toBe('22:30')
    expect(events[1].timestamp).toBe('2026-08-27T20:00:00.000Z')
    expect(getKstGameTime(events[1].displayTimestamp)).toBe('04:59')
  })

  it('moves the US session one hour later in KST outside DST', () => {
    const source = calendars([], ['2026-01-05'])
    const events = getMarketEventsBetween('2026-01-05T00:00:00.000Z', '2026-01-06T00:00:00.000Z', source)

    expect(events[0].timestamp).toBe('2026-01-05T14:30:00.000Z')
    expect(getKstGameTime(events[0].displayTimestamp)).toBe('23:30')
    expect(events[1].timestamp).toBe('2026-01-05T21:00:00.000Z')
    expect(getKstGameTime(events[1].displayTimestamp)).toBe('05:59')
  })

  it('skips KRX-only closures without suppressing US events', () => {
    const source = calendars(['2026-09-29'], ['2026-09-28', '2026-09-29'])
    const next = getNextMarketEvent('2026-09-27T15:00:00.000Z', source)

    expect(next).toMatchObject({ market: 'US', type: 'OPEN', tradingDate: '2026-09-28' })
  })

  it('skips US-only closures without suppressing KRX events', () => {
    const source = calendars(['2026-07-03', '2026-07-06'], ['2026-07-06'])
    const next = getNextMarketEvent('2026-07-02T15:00:00.000Z', source)

    expect(next).toMatchObject({ market: 'KR', type: 'OPEN', tradingDate: '2026-07-03' })
  })

  it('skips weekends and joint closures to the next actual event', () => {
    const source = calendars(['2026-08-31'], ['2026-08-31'])
    const next = getNextMarketEvent('2026-08-28T21:00:00.000Z', source)

    expect(next).toMatchObject({ market: 'KR', type: 'OPEN', tradingDate: '2026-08-31' })
    expect(next?.timestamp).toBe('2026-08-31T00:00:00.000Z')
  })

  it('keeps US tradingDate separate from the KST game date at close', () => {
    const source = calendars([], ['2026-08-27'])
    const close = getMarketEventsBetween('2026-08-27T13:30:00.000Z', '2026-08-27T20:00:00.000Z', source)[0]

    expect(close.tradingDate).toBe('2026-08-27')
    expect(getKstGameDate(close.timestamp)).toBe('2026-08-28')
    expect(getKstGameDate(close.displayTimestamp)).toBe('2026-08-28')
    expect(getKstGameTime(close.displayTimestamp)).toBe('04:59')
  })

  it('formats date, weekday, and time from the KST game timestamp', () => {
    const timestamp = '2026-08-27T00:00:00.000Z'

    expect(getKstGameDate(timestamp)).toBe('2026-08-27')
    expect(formatKstGameDate(timestamp)).toContain('목')
    expect(getKstGameTime(timestamp)).toBe('09:00')
  })

  it('keeps one-week fast-forward equivalent to applying each market event', () => {
    const source = calendars(
      ['2026-08-27', '2026-08-28', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'],
      ['2026-08-27', '2026-08-28', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'],
    )
    const start = '2026-08-27T00:00:00.000Z'
    const target = advanceGameTimestamp(start, 'week')
    const events = getMarketEventsBetween(start, target, source)
    const stepped = events.reduce(applyMarketEventToSessions, createInitialMarketSessions())
    const fastForwarded = applyMarketEventsToSessions(createInitialMarketSessions(), events)

    expect(target).toBe('2026-09-03T00:00:00.000Z')
    expect(fastForwarded).toEqual(stepped)
  })

  it('advances one calendar month without converting to trading days', () => {
    expect(advanceGameTimestamp('2026-01-31T03:15:00.000Z', 'month')).toBe('2026-02-28T03:15:00.000Z')
  })
})
