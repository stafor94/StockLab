import type { ImportantNewsRecord, NewsItem } from './types'

export function getNewsRevealDate(item: NewsItem, gameDates: string[]): string | null {
  if (item.timing === 'PRE_OPEN') return gameDates.find((date) => date >= item.date) ?? null
  return gameDates.find((date) => date > item.date) ?? null
}

export function getVisibleNewsItems(items: NewsItem[], gameDate: string, gameDates: string[]): NewsItem[] {
  return items
    .filter((item) => {
      const revealDate = getNewsRevealDate(item, gameDates)
      return Boolean(revealDate && revealDate <= gameDate)
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export function getNewsRevealedOnDate(items: NewsItem[], gameDate: string, gameDates: string[]): NewsItem[] {
  return items
    .filter((item) => getNewsRevealDate(item, gameDates) === gameDate)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function findFirstImportantNewsStopDate(
  fromDate: string,
  requestedDate: string,
  items: NewsItem[],
  handledNewsIds: Set<string>,
  gameDates: string[],
): string | null {
  const candidates = items
    .filter((item) => item.important && !handledNewsIds.has(item.id))
    .map((item) => getNewsRevealDate(item, gameDates))
    .filter((date): date is string => Boolean(date && date > fromDate && date <= requestedDate))
    .sort()
  return candidates[0] ?? null
}

export function getImportantNewsRecordsBetween(
  fromDate: string,
  toDate: string,
  items: NewsItem[],
  handledNewsIds: Set<string>,
  gameDates: string[],
): ImportantNewsRecord[] {
  return items
    .filter((item) => item.important && !handledNewsIds.has(item.id))
    .map((item) => ({ item, revealDate: getNewsRevealDate(item, gameDates) }))
    .filter((entry): entry is { item: NewsItem; revealDate: string } => Boolean(entry.revealDate))
    .filter(({ revealDate }) => revealDate > fromDate && revealDate <= toDate)
    .sort((a, b) => a.revealDate.localeCompare(b.revealDate) || a.item.id.localeCompare(b.item.id))
    .map(({ item, revealDate }) => ({
      newsId: item.id,
      publishedDate: item.date,
      revealDate,
      timing: item.timing,
      category: item.category,
      market: item.market,
      headline: item.headline,
      summary: item.summary,
    }))
}
