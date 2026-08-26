import { describe, expect, it } from 'vitest'
import news2019 from '../../../public/data/news/2019.json'
import news2020 from '../../../public/data/news/2020.json'
import news2021 from '../../../public/data/news/2021.json'
import news2022 from '../../../public/data/news/2022.json'
import news2023 from '../../../public/data/news/2023.json'
import news2024 from '../../../public/data/news/2024.json'
import news2025 from '../../../public/data/news/2025.json'
import news2026 from '../../../public/data/news/2026.json'
import { parseNewsYearDataset } from '../../data/newsSchema'
import { getNewsRevealDate } from './newsEngine'
import type { NewsItem } from './types'

const yearlyNews: Record<number, unknown> = {
  2019: news2019,
  2020: news2020,
  2021: news2021,
  2022: news2022,
  2023: news2023,
  2024: news2024,
  2025: news2025,
  2026: news2026,
}

function loadYear(year: number): NewsItem[] {
  const dataset = yearlyNews[year]
  if (!dataset) throw new Error(`Missing regression news year ${year}`)
  return parseNewsYearDataset(dataset).items
}

function loadItem(year: number, id: string): NewsItem {
  const item = loadYear(year).find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Missing regression news item ${id}`)
  return item
}

describe('historical news no-lookahead regressions', () => {
  it('reveals the WHO pandemic declaration only after its intraday publication date', () => {
    const item = loadItem(2020, 'N2020-003')
    expect(getNewsRevealDate(item, ['2020-03-11', '2020-03-12'])).toBe('2020-03-12')
  })

  it('allows a verified pre-open emergency Fed action on the same game date', () => {
    const item = loadItem(2020, 'N2020-007')
    expect(getNewsRevealDate(item, ['2020-03-20', '2020-03-23', '2020-03-24'])).toBe('2020-03-23')
  })

  it('moves a Sunday Korean policy announcement to the next game date', () => {
    const item = loadItem(2023, 'N2023-009')
    expect(getNewsRevealDate(item, ['2023-11-03', '2023-11-06'])).toBe('2023-11-06')
  })

  it('keeps a U.S. post-close company disclosure hidden until the next game date', () => {
    const item = loadItem(2025, 'N2025-004')
    expect(getNewsRevealDate(item, ['2025-04-15', '2025-04-16'])).toBe('2025-04-16')
  })

  it('keeps a Korean intraday rate decision hidden until the next game date', () => {
    const item = loadItem(2026, 'N2026-006')
    expect(getNewsRevealDate(item, ['2026-07-16', '2026-07-17'])).toBe('2026-07-17')
  })

  it('does not contain common retrospective outcome phrasing in expanded news copy', () => {
    const items = Array.from({ length: 8 }, (_, index) => loadYear(2019 + index)).flat()
    const forbidden = [
      /이후\s+주가.{0,24}(?:상승|하락)/,
      /결국\s+.{0,32}(?:이어졌|되었|됐다)/,
      /향후\s+.{0,24}\d+(?:%|퍼센트).{0,24}(?:인상|인하)/,
    ]
    for (const item of items) {
      const copy = [item.headline, item.summary, ...item.article].join(' ')
      for (const pattern of forbidden) expect(copy, `${item.id} contains retrospective phrasing`).not.toMatch(pattern)
    }
  })
})
