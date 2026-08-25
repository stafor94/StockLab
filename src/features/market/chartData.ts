import type { MarketSessionPhase } from '../../game/trading/types'
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
  phase: MarketSessionPhase,
): DailyBar[] {
  return bars
    .filter((bar) => phase === 'closed' ? bar.date <= gameDate : bar.date < gameDate)
    .sort((left, right) => left.date.localeCompare(right.date))
}

export function getChartBars(
  bars: DailyBar[],
  gameDate: string,
  range: ChartRange,
  phase: MarketSessionPhase,
): DailyBar[] {
  const known = getKnownFullBars(bars, gameDate, phase)
  if (range === 'ALL') return known

  const from = range === '1M'
    ? shiftUtcDate(gameDate, 1, 0)
    : range === '3M'
      ? shiftUtcDate(gameDate, 3, 0)
      : shiftUtcDate(gameDate, 0, 1)

  return known.filter((bar) => bar.date >= from)
}
