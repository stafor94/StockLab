import { describe, expect, it } from 'vitest'
import type { MarketSessionState, MarketSessionStates } from '../trading/types'
import type { MarketIndexSeries } from '../../types/marketIndex'
import { buildMajorMarketIndexCards, buildMarketIndexQuote } from './marketIndexQuote'

const series: MarketIndexSeries = {
  schemaVersion: 1,
  id: 'TEST_INDEX',
  alias: '테스트 지수',
  market: 'KR',
  source: {
    authoritativeProvider: 'test',
    generatedAt: '2026-08-26T00:00:00.000Z',
    reference: 'test fixture',
  },
  bars: [
    { date: '2017-12-28', open: 95, high: 101, low: 94, close: 100, volume: null },
    { date: '2017-12-29', open: 101, high: 112, low: 100, close: 110, volume: null },
    { date: '2018-01-02', open: 120, high: 122, low: 104, close: 105, volume: null },
    { date: '2018-01-03', open: 999, high: 999, low: 999, close: 999, volume: null },
  ],
}

const session = (phase: MarketSessionState['phase'], tradingDate: string | null): MarketSessionState => ({ phase, tradingDate })

describe('buildMarketIndexQuote', () => {
  it('shows only the prior close before the market opens', () => {
    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-02',
      session: session('preopen', null),
    })).toMatchObject({
      value: 110,
      valueDate: '2017-12-29',
      valueLabel: '직전 종가',
      referenceClose: 100,
      change: 10,
      changeRate: 10,
    })
  })

  it('reveals only the current market open while that market is opened', () => {
    const quote = buildMarketIndexQuote(series, {
      gameDate: '2018-01-02',
      session: session('opened', '2018-01-02'),
    })
    expect(quote).toMatchObject({
      value: 120,
      valueDate: '2018-01-02',
      valueLabel: '현재 거래일 시가',
      referenceClose: 110,
      change: 10,
    })
    expect(quote?.changeRate).toBeCloseTo(9.0909, 4)
  })

  it('reveals the current market close only after that market closes', () => {
    const quote = buildMarketIndexQuote(series, {
      gameDate: '2018-01-02',
      session: session('closed', '2018-01-02'),
    })
    expect(quote).toMatchObject({
      value: 105,
      valueDate: '2018-01-02',
      valueLabel: '현재 거래일 종가',
      referenceClose: 110,
      change: -5,
    })
    expect(quote?.changeRate).toBeCloseTo(-4.5455, 4)
  })

  it('keeps one market on its own last completed trading date when another market advances', () => {
    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-03',
      session: session('closed', '2018-01-02'),
    })).toMatchObject({
      value: 105,
      valueDate: '2018-01-02',
      valueLabel: '현재 거래일 종가',
      change: -5,
    })
  })

  it('never reads a future bar when the current session bar is unavailable', () => {
    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-01',
      session: session('preopen', null),
    })).toMatchObject({ value: 110, valueDate: '2017-12-29' })

    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-04',
      session: session('opened', '2018-01-04'),
    })).toBeNull()
  })
})

describe('buildMajorMarketIndexCards', () => {
  it('uses each index market session independently and keeps unsupported Dow explicit', () => {
    const kospi: MarketIndexSeries = { ...series, id: 'KOSPI', alias: '코스피' }
    const sessions: MarketSessionStates = {
      KR: session('closed', '2018-01-02'),
      US: session('preopen', null),
    }
    const cards = buildMajorMarketIndexCards([kospi], {
      gameDate: '2018-01-03',
      marketSessions: sessions,
    })

    expect(cards.map((card) => card.id)).toEqual(['KOSPI', 'KOSDAQ', 'NASDAQ_COMPOSITE', 'DOW_JONES'])
    expect(cards[0]).toMatchObject({ status: 'ready', quote: { value: 105, valueDate: '2018-01-02' } })
    expect(cards[1].status).toBe('data-unavailable')
    expect(cards[3]).toMatchObject({
      alias: '다우존스',
      status: 'source-unavailable',
      quote: null,
      unavailableReason: '현재 다우존스 공식 과거 데이터는 제공되지 않습니다.',
    })
  })
})
