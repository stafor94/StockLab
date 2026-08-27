import type { MarketCode } from '../../types/market'
import type { MarketIndexSeries } from '../../types/marketIndex'
import type { MarketSessionState, MarketSessionStates } from '../trading/types'

export type MarketIndexValueLabel = '직전 종가' | '현재 거래일 시가' | '현재 거래일 종가'
export type MajorMarketIndexCardStatus = 'ready' | 'data-unavailable' | 'source-unavailable'

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

export interface MajorMarketIndexCard {
  id: string
  alias: string
  market: MarketCode
  status: MajorMarketIndexCardStatus
  quote: MarketIndexQuote | null
  unavailableReason: string | null
}

interface BuildMarketIndexQuoteOptions {
  gameDate: string
  session: MarketSessionState
}

interface BuildMajorMarketIndexCardsOptions {
  gameDate: string
  marketSessions: MarketSessionStates
}

const MAJOR_MARKET_INDICES = [
  { id: 'KOSPI', alias: '코스피', market: 'KR', sourceAvailable: true },
  { id: 'KOSDAQ', alias: '코스닥', market: 'KR', sourceAvailable: true },
  { id: 'NASDAQ_COMPOSITE', alias: '나스닥 종합', market: 'US', sourceAvailable: true },
  {
    id: 'DOW_JONES',
    alias: '다우존스',
    market: 'US',
    sourceAvailable: false,
    unavailableReason: 'Nasdaq Historical Quotes에서 DJIA 과거 이력을 제공하지 않습니다.',
  },
] as const

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
  const tradingDate = options.session.tradingDate
  const referenceDate = tradingDate ?? options.gameDate
  const previousIndex = findPreviousBarIndex(series, referenceDate)

  if (!tradingDate || options.session.phase === 'preopen') {
    if (previousIndex < 0) return null
    const previousBar = series.bars[previousIndex]
    return withChange(series, previousBar.close, previousBar.date, '직전 종가', previousIndex - 1)
  }

  const currentIndex = series.bars.findIndex((bar) => bar.date === tradingDate)
  if (currentIndex < 0 || previousIndex < 0) return null
  const currentBar = series.bars[currentIndex]
  const value = options.session.phase === 'opened' ? currentBar.open : currentBar.close
  return withChange(
    series,
    value,
    currentBar.date,
    options.session.phase === 'opened' ? '현재 거래일 시가' : '현재 거래일 종가',
    previousIndex,
  )
}

export function buildMajorMarketIndexCards(
  seriesList: MarketIndexSeries[],
  options: BuildMajorMarketIndexCardsOptions,
): MajorMarketIndexCard[] {
  const seriesById = new Map(seriesList.map((series) => [series.id, series]))
  return MAJOR_MARKET_INDICES.map((definition) => {
    if (!definition.sourceAvailable) {
      return {
        id: definition.id,
        alias: definition.alias,
        market: definition.market,
        status: 'source-unavailable' as const,
        quote: null,
        unavailableReason: definition.unavailableReason,
      }
    }

    const series = seriesById.get(definition.id)
    const quote = series
      ? buildMarketIndexQuote(series, {
        gameDate: options.gameDate,
        session: options.marketSessions[definition.market],
      })
      : null
    return {
      id: definition.id,
      alias: definition.alias,
      market: definition.market,
      status: quote ? 'ready' as const : 'data-unavailable' as const,
      quote,
      unavailableReason: quote ? null : '공식 지수 데이터를 확인할 수 없습니다.',
    }
  })
}
