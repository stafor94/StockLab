import type { MarketCode } from '../../types/market'
import type { MarketIndexSeries } from '../../types/marketIndex'

export type MarketIndexSessionPhase = 'preopen' | 'opened' | 'closed'
export type MarketIndexValueLabel = '전일 종가' | '오늘 시가' | '오늘 종가' | '직전 종가'

export interface MarketIndexQuote {
  id: string
  alias: string
  market: MarketCode
  value: number
  valueDate: string
  valueLabel: MarketIndexValueLabel
  referenceClose: number | null
  change: number | null
  changeRate: number | null
}

interface BuildMarketIndexQuoteOptions {
  gameDate: string
  sessionPhase: MarketIndexSessionPhase
  isMarketOpen: boolean
}

function findPreviousBarIndex(series: MarketIndexSeries, date: string): number {
  for (let index = series.bars.length - 1; index >= 0; index -= 1) {
    if (series.bars[index].date < date) return index
  }
  return -1
}

function withChange(
  series: MarketIndexSeries,
  value: number,
  valueDate: string,
  valueLabel: MarketIndexValueLabel,
  referenceIndex: number,
): MarketIndexQuote {
  const referenceClose = referenceIndex >= 0 ? series.bars[referenceIndex].close : null
  const change = referenceClose === null ? null : value - referenceClose
  const changeRate = referenceClose === null || referenceClose === 0
    ? null
    : ((value - referenceClose) / referenceClose) * 100
  return {
    id: series.id,
    alias: series.alias,
    market: series.market,
    value,
    valueDate,
    valueLabel,
    referenceClose,
    change,
    changeRate,
  }
}

export function buildMarketIndexQuote(
  series: MarketIndexSeries,
  options: BuildMarketIndexQuoteOptions,
): MarketIndexQuote | null {
  const previousIndex = findPreviousBarIndex(series, options.gameDate)

  if (!options.isMarketOpen || options.sessionPhase === 'preopen') {
    if (previousIndex < 0) return null
    const previousBar = series.bars[previousIndex]
    return withChange(
      series,
      previousBar.close,
      previousBar.date,
      options.isMarketOpen ? '전일 종가' : '직전 종가',
      previousIndex - 1,
    )
  }

  const todayIndex = series.bars.findIndex((bar) => bar.date === options.gameDate)
  if (todayIndex < 0 || previousIndex < 0) return null
  const todayBar = series.bars[todayIndex]
  const value = options.sessionPhase === 'opened' ? todayBar.open : todayBar.close
  return withChange(
    series,
    value,
    todayBar.date,
    options.sessionPhase === 'opened' ? '오늘 시가' : '오늘 종가',
    previousIndex,
  )
}
