import type { AssetPriceSeries } from '../../types/market'
import type { MarketSessionPhase } from '../../game/trading/types'

export type MarketQuoteSource = 'previous-close' | 'today-open' | 'today-close'

export interface MarketQuote {
  price: number
  priceDate: string
  source: MarketQuoteSource
  comparisonClose: number | null
  changeRate: number | null
}

export function selectMarketQuote(series: AssetPriceSeries, gameDate: string, phase: MarketSessionPhase): MarketQuote | null {
  const previousBars = series.bars.filter((bar) => bar.date < gameDate)
  const previous = previousBars.at(-1)
  const beforePrevious = previousBars.at(-2)
  const today = series.bars.find((bar) => bar.date === gameDate)

  let price: number
  let priceDate: string
  let source: MarketQuoteSource
  let comparisonClose: number | null

  if (phase === 'closed' && today) {
    price = today.close
    priceDate = today.date
    source = 'today-close'
    comparisonClose = previous?.close ?? null
  } else if (phase === 'opened' && today) {
    price = today.open
    priceDate = today.date
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
  if (source === 'today-close') return '오늘 종가'
  if (source === 'today-open') return '오늘 시가'
  return '최근 종가'
}

export function formatMarketPrice(value: number, currency: 'KRW' | 'USD'): string {
  const formatted = new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(value)
  return currency === 'KRW' ? `₩${formatted}` : `$${formatted}`
}
