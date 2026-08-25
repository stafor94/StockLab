import type { MarketCalendars, MarketCode } from '../../types/market'

export type GameDateStep = 'day' | 'week' | 'month'

function parseIsoDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${date}`)
  }
  return parsed
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  const value = parseIsoDate(date)
  value.setUTCDate(value.getUTCDate() + days)
  return formatIsoDate(value)
}

function addMonths(date: string, months: number): string {
  const source = parseIsoDate(date)
  const targetMonth = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1))
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate()
  targetMonth.setUTCDate(Math.min(source.getUTCDate(), lastDay))
  return formatIsoDate(targetMonth)
}

function combinedTradingDates(calendars: MarketCalendars): string[] {
  return [...new Set([...calendars.KR.tradingDates, ...calendars.US.tradingDates])].sort()
}

export function isMarketOpenOnDate(
  date: string,
  market: MarketCode,
  calendars: MarketCalendars,
): boolean {
  return calendars[market].tradingDates.includes(date)
}

export function getOpenMarketsOnDate(date: string, calendars: MarketCalendars): MarketCode[] {
  const markets: MarketCode[] = []
  if (isMarketOpenOnDate(date, 'KR', calendars)) markets.push('KR')
  if (isMarketOpenOnDate(date, 'US', calendars)) markets.push('US')
  return markets
}

export function getNextGameDate(currentDate: string, calendars: MarketCalendars): string | null {
  return combinedTradingDates(calendars).find((date) => date > currentDate) ?? null
}

export function findGameDateOnOrAfter(targetDate: string, calendars: MarketCalendars): string | null {
  return combinedTradingDates(calendars).find((date) => date >= targetDate) ?? null
}

export function advanceGameDate(
  currentDate: string,
  step: GameDateStep,
  calendars: MarketCalendars,
): string | null {
  if (step === 'day') {
    return getNextGameDate(currentDate, calendars)
  }

  const targetDate = step === 'week' ? addDays(currentDate, 7) : addMonths(currentDate, 1)
  return findGameDateOnOrAfter(targetDate, calendars)
}
