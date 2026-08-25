import type { MarketCalendar, MarketCode } from '../../types/market'

export const US_T_PLUS_ONE_EFFECTIVE_DATE = '2024-05-28'

export function getSettlementLag(market: MarketCode, tradeDate: string): 1 | 2 {
  if (market === 'US' && tradeDate >= US_T_PLUS_ONE_EFFECTIVE_DATE) return 1
  return 2
}

export function getSettlementDate(
  market: MarketCode,
  tradeDate: string,
  calendar: MarketCalendar,
): string | null {
  const lag = getSettlementLag(market, tradeDate)
  const futureTradingDates = calendar.tradingDates.filter((date) => date > tradeDate)
  return futureTradingDates[lag - 1] ?? null
}
