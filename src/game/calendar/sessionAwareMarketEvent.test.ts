import { describe, expect, it } from 'vitest'
import type { MarketCalendar, MarketCalendars, MarketCode } from '../../types/market'
import { applyMarketEventToSessions, createInitialMarketSessions } from './marketTimeline'
import { getNextSessionAwareMarketEvent } from './sessionAwareMarketEvent'

function calendar(market: MarketCode, tradingDates: string[]): MarketCalendar {
  return {
    schemaVersion: 1,
    market,
    timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
    coverage: { from: '2018-01-01', to: '2018-12-31' },
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

describe('session-aware market event recovery', () => {
  it('recovers a missed U.S. open before exposing the following close', () => {
    const source = calendars(['2018-03-12', '2018-03-13'], ['2018-03-12', '2018-03-13'])
    const currentTimestamp = '2018-03-12T15:00:00.000Z' // 2018-03-13 00:00 KST
    const staleSessions = createInitialMarketSessions()

    const recoveredOpen = getNextSessionAwareMarketEvent(currentTimestamp, source, staleSessions)
    expect(recoveredOpen).toMatchObject({
      market: 'US',
      type: 'OPEN',
      tradingDate: '2018-03-12',
      timestamp: '2018-03-12T13:30:00.000Z',
    })

    const repairedSessions = applyMarketEventToSessions(staleSessions, recoveredOpen!)
    const next = getNextSessionAwareMarketEvent(currentTimestamp, source, repairedSessions)
    expect(next).toMatchObject({
      market: 'US',
      type: 'CLOSE',
      tradingDate: '2018-03-12',
      timestamp: '2018-03-12T20:00:00.000Z',
    })
  })
})
