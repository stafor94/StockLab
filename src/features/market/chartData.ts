import type { MarketSessionState } from '../../game/trading/types'
import type { DailyBar } from '../../types/market'

export type ChartRange = '1M' | '3M' | '1Y' | 'ALL'

function shiftUtcDate(date: string, months: number, years: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCFullYear(value.getUTCFullYear() - years)
  value.setUTCMonth(value.getUTCMonth() - months)
  return value.toISOString().slice(0, 10)
}

export function getKnownFullBars(
  bars: DailyBar[],
  gameDate: string,
  session: MarketSessionState,
): DailyBar[] {
  const referenceDate = session.tradingDate ?? gameDate
  return bars
    .filter((bar) => session.phase === 'closed' && session.tradingDate ? bar.date <= referenceDate : bar.date < referenceDate)
    .sort((left, right) => left.date.localeCompare(right.date))
}

export function getChartBars(
  bars: DailyBar[],
  gameDate: string,
  range: ChartRange,
  session: MarketSessionState,
): DailyBar[] {
  const known = getKnownFullBars(bars, gameDate, session)
  if (range === 'ALL') return known
  const referenceDate = session.tradingDate ?? gameDate
  const from = range === '1M'
    ? shiftUtcDate(referenceDate, 1, 0)
    : range === '3M'
      ? shiftUtcDate(referenceDate, 3, 0)
      : shiftUtcDate(referenceDate, 0, 1)

  return known.filter((bar) => bar.date >= from)
}
