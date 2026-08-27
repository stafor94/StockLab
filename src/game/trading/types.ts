import type { AssetCurrency, MarketCode } from '../../types/market'

export type MarketSessionPhase = 'preopen' | 'opened' | 'closed'
export type MarketSessionExecutionPrice = 'open' | 'close'
export type MarketOrderKind = 'buy-amount' | 'buy-quantity' | 'sell-quantity' | 'sell-all'

export interface MarketSessionState {
  phase: MarketSessionPhase
  tradingDate: string | null
}

export type MarketSessionStates = Record<MarketCode, MarketSessionState>

export interface MarketOrder {
  id: string
  assetId: string
  market: MarketCode
  currency: AssetCurrency
  tradeDate: string
  kind: MarketOrderKind
  requestedAmount?: number
  requestedQuantity?: number
}

export interface QueueOrderInput {
  assetId: string
  market: MarketCode
  currency: AssetCurrency
  kind: MarketOrderKind
  requestedAmount?: number
  requestedQuantity?: number
}

export interface Position {
  assetId: string
  market: MarketCode
  currency: AssetCurrency
  quantity: number
  averagePrice: number
}

export interface TradeExecution {
  orderId: string
  assetId: string
  market: MarketCode
  currency: AssetCurrency
  side: 'buy' | 'sell'
  quantity: number
  price: number
  grossAmount: number
  commission: number
  transactionTax: number
  ruralSpecialTax: number
  secSection31Fee: number
  finraTaf: number
  totalFees: number
  cashAmount: number
  costBasis: number | null
  realizedPnl: number | null
  executedDate: string
  settlementDate: string | null
}

export interface PendingSettlement {
  id: string
  orderId: string
  assetId: string
  market: MarketCode
  currency: AssetCurrency
  amount: number
  tradeDate: string
  settlementDate: string
}

export interface TradingAccountState {
  krwCash: number
  usdCash: number
  marketSessions: MarketSessionStates
  positions: Position[]
  pendingOrders: MarketOrder[]
  pendingSettlements: PendingSettlement[]
  trades: TradeExecution[]
}

export type OrderCancelReason =
  | 'missing-open-price'
  | 'insufficient-cash'
  | 'insufficient-position'
  | 'invalid-order'
  | 'missing-settlement-date'
  | 'wrong-trade-date'

export interface OrderExecutionResult {
  orderId: string
  status: 'filled' | 'cancelled'
  reason?: OrderCancelReason
  trade?: TradeExecution
}

export interface MarketOpenExecutionContext {
  market: MarketCode
  date: string
  openPrices: Record<string, number | undefined>
  settlementDates: Record<string, string | undefined>
}

export interface MarketSessionPriceExecutionContext {
  date: string
  price: number
  priceSource: MarketSessionExecutionPrice
  settlementDate?: string
}
