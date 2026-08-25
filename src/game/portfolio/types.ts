import type { LoanAccountState } from '../loan/types'
import type { MarketSessionPhase, PendingSettlement, Position, TradeExecution } from '../trading/types'

export interface KnownValuationPrice {
  assetId: string
  price: number
  priceDate: string
  source: 'previous-close' | 'today-open' | 'today-close'
}

export interface PositionValuation {
  assetId: string
  quantity: number
  currency: 'KRW' | 'USD'
  averagePrice: number
  price: number | null
  priceDate: string | null
  priceSource: KnownValuationPrice['source'] | null
  marketValue: number | null
  costBasis: number
  unrealizedPnl: number | null
  unrealizedRate: number | null
  marketValueKrw: number | null
  unrealizedPnlKrw: number | null
}

export interface PortfolioSnapshot {
  positions: PositionValuation[]
  grossAssetsKrw: number | null
  liabilitiesKrw: number
  netWorthKrw: number | null
  principalRepaidKrw: number
  strategyCapitalKrw: number | null
  strategyReturnRate: number | null
  realizedPnlKrw: number | null
  realizedPnlIncomplete: boolean
  unrealizedPnlKrw: number | null
  cumulativeFeesKrw: number | null
  valuationComplete: boolean
  missingPriceAssetIds: string[]
  needsFxRate: boolean
}

export interface PortfolioSnapshotInput {
  gameDate: string
  marketSessionPhase: MarketSessionPhase
  krwCash: number
  usdCash: number
  loan: LoanAccountState
  positions: Position[]
  pendingSettlements: PendingSettlement[]
  trades: TradeExecution[]
  prices: Record<string, KnownValuationPrice | undefined>
  usdKrwRate: number | null
}

export interface ReturnBadgeTier {
  id: string
  label: string
  minReturn: number
  nextMinReturn: number | null
}
