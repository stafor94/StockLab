import { describe, expect, it } from 'vitest'
import { buildMajorMarketIndexCards, buildMarketIndexQuote } from './marketIndexQuote'
import type { MarketIndexSeries } from '../../types/marketIndex'

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

describe('buildMarketIndexQuote', () => {
  it('shows only the prior close before the market opens', () => {
    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-02',
      sessionPhase: 'preopen',
      isMarketOpen: true,
    })).toMatchObject({
      value: 110,
      valueDate: '2017-12-29',
      valueLabel: '전일 종가',
      referenceClose: 100,
      change: 10,
      changeRate: 10,
    })
  })

  it('reveals the current open and compares it with the prior close during the opened phase', () => {
    const quote = buildMarketIndexQuote(series, {
      gameDate: '2018-01-02',
      sessionPhase: 'opened',
      isMarketOpen: true,
    })
    expect(quote).toMatchObject({
      value: 120,
      valueDate: '2018-01-02',
      valueLabel: '오늘 시가',
      referenceClose: 110,
      change: 10,
    })
    expect(quote?.changeRate).toBeCloseTo(9.0909, 4)
  })

  it('reveals the current close and compares it with the prior close only after market close', () => {
    const quote = buildMarketIndexQuote(series, {
      gameDate: '2018-01-02',
      sessionPhase: 'closed',
      isMarketOpen: true,
    })
    expect(quote).toMatchObject({
      value: 105,
      valueDate: '2018-01-02',
      valueLabel: '오늘 종가',
      referenceClose: 110,
      change: -5,
    })
    expect(quote?.changeRate).toBeCloseTo(-4.5455, 4)
  })

  it('keeps a closed market on its last completed close regardless of the global session phase', () => {
    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-02',
      sessionPhase: 'closed',
      isMarketOpen: false,
    })).toMatchObject({
      value: 110,
      valueDate: '2017-12-29',
      valueLabel: '직전 종가',
      change: 10,
    })
  })

  it('never reads a future bar when the current session bar is unavailable', () => {
    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-01',
      sessionPhase: 'preopen',
      isMarketOpen: false,
    })).toMatchObject({ value: 110, valueDate: '2017-12-29' })

    expect(buildMarketIndexQuote(series, {
      gameDate: '2018-01-04',
      sessionPhase: 'opened',
      isMarketOpen: true,
    })).toBeNull()
  })
})

describe('buildMajorMarketIndexCards', () => {
  it('keeps the four-card order while refusing to synthesize unsupported Dow history', () => {
    const kospi: MarketIndexSeries = { ...series, id: 'KOSPI', alias: '코스피' }
    const cards = buildMajorMarketIndexCards([kospi], {
      gameDate: '2018-01-01',
      sessionPhase: 'preopen',
      openMarkets: [],
    })

    expect(cards.map((card) => card.id)).toEqual(['KOSPI', 'KOSDAQ', 'NASDAQ_COMPOSITE', 'DOW_JONES'])
    expect(cards[0]).toMatchObject({ status: 'ready', quote: { value: 110 } })
    expect(cards[1].status).toBe('data-unavailable')
    expect(cards[3]).toMatchObject({
      alias: '다우존스',
      status: 'source-unavailable',
      quote: null,
    })
    expect(cards[3].unavailableReason).toContain('Nasdaq Historical Quotes')
  })
})
