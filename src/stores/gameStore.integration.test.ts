import { beforeEach, describe, expect, it } from 'vitest'
import { selectGuidance } from '../features/guidance/guidanceSelector'
import { advanceGameTimestamp, applyMarketEventsToSessions, createInitialMarketSessions, getKstGameDate, getMarketEventsBetween } from '../game/calendar/marketTimeline'
import type { CorporateEvent } from '../game/corporate/types'
import type { NewsItem } from '../game/news/types'
import type { MarketCalendar, MarketCalendars, MarketCode } from '../types/market'
import type { BaseRateSeries } from '../types/rates'
import { useGameStore } from './gameStore'

const gameDates = ['2018-01-01', '2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05', '2018-02-01']
const baseRates: BaseRateSeries = {
  schemaVersion: 1,
  name: 'BOK_BASE_RATE',
  coverage: { from: '2018-01-01', to: '2026-08-25' },
  rates: [{ date: '2017-11-30', annualRate: 1.5 }],
  source: {
    provider: 'Bank of Korea',
    statCode: '722Y001',
    itemCode: '0101000',
    mode: 'ecos',
    generatedAt: '2026-08-26T00:00:00.000Z',
  },
}

const source = { provider: 'TEST', reference: 'fixture' }

function importantSplit(date: string): CorporateEvent {
  return {
    id: `SPLIT-${date}`,
    assetId: 'U001',
    date,
    timing: 'PRE_OPEN',
    type: 'SPLIT',
    title: '중요 분할',
    summary: '동일일 이벤트 순서 테스트',
    important: true,
    source,
    payload: { numerator: 2, denominator: 1 },
  }
}

function quietSplit(date: string): CorporateEvent {
  return {
    ...importantSplit(date),
    id: `QUIET-SPLIT-${date}`,
    title: '일반 분할',
    important: false,
  }
}

function importantNews(date: string): NewsItem {
  return {
    id: `NEWS-${date}`,
    date,
    timing: 'PRE_OPEN',
    category: 'COMPANY',
    market: 'US',
    headline: '중요 뉴스',
    summary: '동일일 이벤트 순서 테스트',
    article: ['테스트 기사'],
    important: true,
    relatedAssetIds: ['U001'],
    relatedSectors: [],
    sourceReferences: ['https://example.test/source'],
  }
}

function context(corporateEvents: CorporateEvent[], newsItems: NewsItem[]) {
  return {
    baseRates,
    bankBusinessDates: gameDates,
    corporateEvents,
    newsItems,
    gameDates,
  }
}

function calendar(market: MarketCode, tradingDates: string[]): MarketCalendar {
  return {
    schemaVersion: 1,
    market,
    timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
    coverage: { from: '2018-01-01', to: '2018-02-01' },
    tradingDates,
    closures: [],
    source: { authoritativeProvider: market === 'KR' ? 'KRX' : 'Nasdaq', mode: 'generated', generatedAt: null },
  }
}

beforeEach(() => {
  localStorage.clear()
  useGameStore.getState().resetGame()
})

describe('integrated game timeline', () => {
  it('acknowledges loan alert badges without changing the underlying overdue state', () => {
    const initialLoan = useGameStore.getState().loan
    const firstFailure = { id: 'L000001', date: '2018-02-01', type: 'payment_failed' as const, amount: 0, note: '첫 미납' }
    useGameStore.setState({
      loan: {
        ...initialLoan,
        status: 'overdue',
        consecutiveMissedMonths: 1,
        history: [firstFailure],
      },
    })

    expect(selectGuidance(useGameStore.getState()).navigation.자산.attentionCount).toBe(1)
    useGameStore.getState().acknowledgeLoanPaymentFailures()

    const acknowledged = useGameStore.getState()
    expect(acknowledged.guidance.seenLoanPaymentFailures).toBe(1)
    expect(acknowledged.loan.status).toBe('overdue')
    expect(acknowledged.loan.consecutiveMissedMonths).toBe(1)
    expect(selectGuidance(acknowledged).navigation.자산.attentionCount).toBeUndefined()

    useGameStore.setState({
      loan: {
        ...acknowledged.loan,
        consecutiveMissedMonths: 2,
        history: [
          ...acknowledged.loan.history,
          { id: 'L000002', date: '2018-03-01', type: 'payment_failed', amount: 0, note: '둘째 미납' },
        ],
      },
    })
    expect(selectGuidance(useGameStore.getState()).navigation.자산.attentionCount).toBe(1)
  })

  it('queues same-day important corporate action and news once, blocks until both are acknowledged, then resumes without duplicates', () => {
    const corporate = importantSplit('2018-01-03')
    const news = importantNews('2018-01-03')
    const advanceContext = context([corporate], [news])

    const first = useGameStore.getState().advanceToDate('2018-01-04', advanceContext)
    expect(first).toMatchObject({
      ok: true,
      gameDate: '2018-01-03',
      stoppedForImportantEvent: true,
      stopReason: 'corporate',
      corporateEvents: 1,
      newsItems: 1,
    })
    expect(useGameStore.getState().pendingImportantEvents).toHaveLength(1)
    expect(useGameStore.getState().pendingImportantNews).toHaveLength(1)
    expect(useGameStore.getState().corporateHistory).toHaveLength(1)

    useGameStore.getState().acknowledgeCorporateEvent()
    const blockedByNews = useGameStore.getState().advanceToDate('2018-01-04', advanceContext)
    expect(blockedByNews.ok).toBe(false)
    expect(blockedByNews.stoppedForImportantEvent).toBe(true)
    expect(useGameStore.getState().gameDate).toBe('2018-01-03')
    expect(useGameStore.getState().corporateHistory).toHaveLength(1)

    useGameStore.getState().acknowledgeImportantNews()
    expect(useGameStore.getState().readNewsIds).toEqual([news.id])

    const resumed = useGameStore.getState().advanceToDate('2018-01-04', advanceContext)
    expect(resumed).toMatchObject({ ok: true, gameDate: '2018-01-04', corporateEvents: 0, newsItems: 0 })
    expect(useGameStore.getState().corporateHistory).toHaveLength(1)
    expect(useGameStore.getState().pendingImportantEvents).toHaveLength(0)
    expect(useGameStore.getState().pendingImportantNews).toHaveLength(0)
    expect(useGameStore.getState().readNewsIds).toEqual([news.id])
  })

  it('does not reveal or process corporate actions or news after the requested date', () => {
    const corporate = importantSplit('2018-01-04')
    const news = importantNews('2018-01-04')

    const result = useGameStore.getState().advanceToDate('2018-01-03', context([corporate], [news]))

    expect(result).toMatchObject({
      ok: true,
      gameDate: '2018-01-03',
      corporateEvents: 0,
      newsItems: 0,
      stoppedForImportantEvent: false,
      stopReason: null,
    })
    expect(useGameStore.getState().corporateHistory).toHaveLength(0)
    expect(useGameStore.getState().pendingImportantEvents).toHaveLength(0)
    expect(useGameStore.getState().pendingImportantNews).toHaveLength(0)
  })

  it('keeps a corporate action while one-month fast-forward applies all intermediate market events', () => {
    const initial = useGameStore.getState()
    useGameStore.setState({
      positions: [{ assetId: 'U001', market: 'US', currency: 'USD', quantity: 10, averagePrice: 100 }],
    })
    const startTimestamp = initial.gameTimestamp
    const targetTimestamp = advanceGameTimestamp(startTimestamp, 'month')
    const targetDate = getKstGameDate(targetTimestamp)
    const marketCalendars: MarketCalendars = {
      KR: calendar('KR', ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05', '2018-02-01']),
      US: calendar('US', ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05', '2018-02-01']),
    }
    const events = getMarketEventsBetween(startTimestamp, targetTimestamp, marketCalendars)
    const expectedSessions = applyMarketEventsToSessions(createInitialMarketSessions(), events)

    const dateResult = useGameStore.getState().advanceToDate(targetDate, context([quietSplit('2018-01-03')], []))
    expect(dateResult).toMatchObject({ ok: true, stoppedForImportantEvent: false, corporateEvents: 1 })
    const cancelled = useGameStore.getState().fastForwardTimeline(events, targetTimestamp)

    const state = useGameStore.getState()
    expect(cancelled).toBe(0)
    expect(targetDate).toBe('2018-02-01')
    expect(state.positions[0]).toMatchObject({ assetId: 'U001', quantity: 20, averagePrice: 50 })
    expect(state.corporateHistory.map((record) => record.eventId)).toEqual(['QUIET-SPLIT-2018-01-03'])
    expect(state.marketSessions).toEqual(expectedSessions)
    expect(state.gameTimestamp).toBe(targetTimestamp)
  })
})
