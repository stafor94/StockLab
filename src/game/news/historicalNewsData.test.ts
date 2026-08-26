import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseNewsYearDataset } from '../../data/newsSchema'
import { getNewsRevealDate } from './newsEngine'
import type { NewsItem } from './types'

async function loadYear(year: number): Promise<NewsItem[]> {
  const path = fileURLToPath(new URL(`../../../public/data/news/${year}.json`, import.meta.url))
  return parseNewsYearDataset(JSON.parse(await readFile(path, 'utf8')) as unknown).items
}

async function loadItem(year: number, id: string): Promise<NewsItem> {
  const item = (await loadYear(year)).find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Missing regression news item ${id}`)
  return item
}

describe('historical news no-lookahead regressions', () => {
  it('reveals the WHO pandemic declaration only after its intraday publication date', async () => {
    const item = await loadItem(2020, 'N2020-003')
    expect(getNewsRevealDate(item, ['2020-03-11', '2020-03-12'])).toBe('2020-03-12')
  })

  it('allows a verified pre-open emergency Fed action on the same game date', async () => {
    const item = await loadItem(2020, 'N2020-007')
    expect(getNewsRevealDate(item, ['2020-03-20', '2020-03-23', '2020-03-24'])).toBe('2020-03-23')
  })

  it('moves a Sunday Korean policy announcement to the next game date', async () => {
    const item = await loadItem(2023, 'N2023-009')
    expect(getNewsRevealDate(item, ['2023-11-03', '2023-11-06'])).toBe('2023-11-06')
  })

  it('keeps a U.S. post-close company disclosure hidden until the next game date', async () => {
    const item = await loadItem(2025, 'N2025-004')
    expect(getNewsRevealDate(item, ['2025-04-15', '2025-04-16'])).toBe('2025-04-16')
  })

  it('keeps a Korean intraday rate decision hidden until the next game date', async () => {
    const item = await loadItem(2026, 'N2026-006')
    expect(getNewsRevealDate(item, ['2026-07-16', '2026-07-17'])).toBe('2026-07-17')
  })

  it('does not contain common retrospective outcome phrasing in expanded news copy', async () => {
    const items = (await Promise.all(Array.from({ length: 8 }, (_, index) => loadYear(2019 + index)))).flat()
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
