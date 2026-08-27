import type { MarketCalendar, MarketClosureDataset } from '../../types/market'

function parseIsoDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ISO date: ${value}`)
  return parsed
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function eachDate(from: string, to: string): string[] {
  const result: string[] = []
  const cursor = parseIsoDate(from)
  const last = parseIsoDate(to)
  while (cursor <= last) {
    result.push(formatIsoDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

export function applyMarketClosureDataset(
  calendar: MarketCalendar,
  dataset: MarketClosureDataset,
): MarketCalendar {
  if (dataset.market !== calendar.market) {
    throw new Error(`Closure dataset market ${dataset.market} does not match calendar ${calendar.market}`)
  }
  if (dataset.coverage.from > calendar.coverage.from || dataset.coverage.to < calendar.coverage.to) {
    throw new Error(
      `${calendar.market} closure metadata ${dataset.coverage.from}..${dataset.coverage.to} does not cover calendar ${calendar.coverage.from}..${calendar.coverage.to}`,
    )
  }

  const tradingDates = new Set(calendar.tradingDates)
  const closures = new Map<string, string>()
  for (const closure of calendar.closures) {
    if (closure.date >= calendar.coverage.from && closure.date <= calendar.coverage.to) {
      closures.set(closure.date, closure.reason)
    }
  }
  for (const closure of dataset.closures) {
    if (closure.date < calendar.coverage.from || closure.date > calendar.coverage.to) continue
    if (tradingDates.has(closure.date)) {
      throw new Error(`${calendar.market} closure ${closure.date} (${closure.reason}) is also a trading date`)
    }
    closures.set(closure.date, closure.reason)
  }

  return {
    ...calendar,
    closures: [...closures.entries()]
      .map(([date, reason]) => ({ date, reason }))
      .sort((left, right) => left.date.localeCompare(right.date)),
  }
}

export function getUnclassifiedWeekdayClosures(calendar: MarketCalendar): string[] {
  const tradingDates = new Set(calendar.tradingDates)
  const closures = new Set(calendar.closures.map((closure) => closure.date))
  return eachDate(calendar.coverage.from, calendar.coverage.to).filter((date) => {
    const day = parseIsoDate(date).getUTCDay()
    const weekend = day === 0 || day === 6
    return !weekend && !tradingDates.has(date) && !closures.has(date)
  })
}

export function assertCompleteMarketCalendar(calendar: MarketCalendar): void {
  const missing = getUnclassifiedWeekdayClosures(calendar)
  if (missing.length > 0) {
    throw new Error(
      `${calendar.market} calendar has ${missing.length} unclassified weekday closure(s): ${missing.slice(0, 12).join(', ')}`,
    )
  }
}
