import { beforeEach, describe, expect, it } from 'vitest'
import type { CorporateEvent } from '../game/corporate/types'
import type { NewsItem } from '../game/news/types'
import type { BaseRateSeries } from '../types/rates'
import { useGameStore } from './gameStore'

const gameDates = ['2018-01-01', '2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05']
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

beforeEach(() => {
  localStorage.clear()
  useGameStore.getState().resetGame()
  useGameStore.setState({ marketSessionPhase: 'closed' })
})

describe('integrated game timeline', () => {
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
    useGameStore.setState({ marketSessionPhase: 'closed' })

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
})
