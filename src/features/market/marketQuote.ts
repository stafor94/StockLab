import type { MarketSessionState } from '../../game/trading/types'
import type { AssetPriceSeries } from '../../types/market'
import { formatMoney } from '../../utils/money'

export type MarketQuoteSource = 'previous-close' | 'today-open' | 'today-close'

export interface MarketQuote {
  price: number
  priceDate: string
  source: MarketQuoteSource
  comparisonClose: number | null
  changeRate: number | null
}

export function selectMarketQuote(series: AssetPriceSeries, gameDate: string, session: MarketSessionState): MarketQuote | null {
  const tradingDate = session.tradingDate
  const referenceDate = tradingDate ?? gameDate
  const previousBars = series.bars.filter((bar) => bar.date < referenceDate)
  const previous = previousBars.at(-1)
  const beforePrevious = previousBars.at(-2)
  const currentBar = tradingDate ? series.bars.find((bar) => bar.date === tradingDate) : undefined

  let price: number
  let priceDate: string
  let source: MarketQuoteSource
  let comparisonClose: number | null

  if (session.phase === 'closed' && currentBar) {
    price = currentBar.close
    priceDate = currentBar.date
    source = 'today-close'
    comparisonClose = previous?.close ?? null
  } else if (session.phase === 'opened' && currentBar) {
    price = currentBar.open
    priceDate = currentBar.date
    source = 'today-open'
    comparisonClose = previous?.close ?? null
  } else if (previous) {
    price = previous.close
    priceDate = previous.date
    source = 'previous-close'
    comparisonClose = beforePrevious?.close ?? null
  } else {
    return null
  }

  const changeRate = comparisonClose !== null && comparisonClose !== 0
    ? ((price - comparisonClose) / comparisonClose) * 100
    : null

  return { price, priceDate, source, comparisonClose, changeRate }
}

export function marketQuoteSourceLabel(source: MarketQuoteSource): string {
  if (source === 'today-close') return '최근 종가'
  if (source === 'today-open') return '현재 거래일 시가'
  return '직전 종가'
}

export function formatMarketPrice(value: number, currency: 'KRW' | 'USD'): string {
  return formatMoney(value, currency)
}
