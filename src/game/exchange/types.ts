import type { MarketSessionPhase } from '../trading/types'

export type ExchangeDirection = 'KRW_TO_USD' | 'USD_TO_KRW'

export interface ExchangeRecord {
  id: string
  date: string
  direction: ExchangeDirection
  sourceAmount: number
  targetAmount: number
  referenceRate: number
  appliedRate: number
  spreadRate: number
  feeEquivalentKrw: number
}

export interface ExchangeState {
  krwCash: number
  usdCash: number
  marketSessionPhase: MarketSessionPhase
  exchangeHistory: ExchangeRecord[]
  nextExchangeNumber: number
}

export interface ExchangeRequest {
  direction: ExchangeDirection
  amount: number
}

export interface ExchangeQuote {
  direction: ExchangeDirection
  sourceAmount: number
  targetAmount: number
  referenceRate: number
  appliedRate: number
  spreadRate: number
  feeEquivalentKrw: number
}
