import { describe, expect, it } from 'vitest'
import { findFirstImportantNewsStopDate, getNewsRevealDate, getVisibleNewsItems } from './newsEngine'
import type { NewsItem } from './types'

const gameDates = ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05']
const base: Omit<NewsItem, 'id' | 'date' | 'timing' | 'headline'> = {
  category: 'MARKET',
  market: 'GLOBAL',
  summary: '요약',
  article: ['게임용으로 작성된 상세 기사입니다.'],
  important: false,
  relatedAssetIds: [],
  relatedSectors: [],
  sourceReferences: ['official:test'],
}

describe('news reveal rules', () => {
  it('reveals pre-open news on the same game day and post-close news on the next game day', () => {
    const pre: NewsItem = { ...base, id: 'N1', date: '2018-01-03', timing: 'PRE_OPEN', headline: '아침 뉴스' }
    const post: NewsItem = { ...base, id: 'N2', date: '2018-01-03', timing: 'POST_CLOSE', headline: '마감 뉴스' }
    expect(getNewsRevealDate(pre, gameDates)).toBe('2018-01-03')
    expect(getNewsRevealDate(post, gameDates)).toBe('2018-01-04')
  })

  it('moves weekend pre-open publication to the next game day', () => {
    const item: NewsItem = { ...base, id: 'N3', date: '2017-12-31', timing: 'PRE_OPEN', headline: '휴일 뉴스' }
    expect(getNewsRevealDate(item, gameDates)).toBe('2018-01-02')
  })

  it('never exposes an item before its reveal date', () => {
    const item: NewsItem = { ...base, id: 'N4', date: '2018-01-03', timing: 'POST_CLOSE', headline: '마감 뉴스' }
    expect(getVisibleNewsItems([item], '2018-01-03', gameDates)).toHaveLength(0)
    expect(getVisibleNewsItems([item], '2018-01-04', gameDates)).toHaveLength(1)
  })

  it('returns the first unhandled important-news stop date', () => {
    const items: NewsItem[] = [
      { ...base, id: 'N5', date: '2018-01-03', timing: 'PRE_OPEN', headline: '중요 1', important: true },
      { ...base, id: 'N6', date: '2018-01-04', timing: 'PRE_OPEN', headline: '중요 2', important: true },
    ]
    expect(findFirstImportantNewsStopDate('2018-01-02', '2018-01-05', items, new Set(), gameDates)).toBe('2018-01-03')
    expect(findFirstImportantNewsStopDate('2018-01-02', '2018-01-05', items, new Set(['N5']), gameDates)).toBe('2018-01-04')
  })
})
