import type { AssetCurrency, MarketCode } from '../../types/market'
import type { MarketOrder, Position } from '../trading/types'

export type CorporateEventTiming = 'PRE_OPEN' | 'INTRADAY' | 'POST_CLOSE'
export type CorporateEventType = 'DIVIDEND' | 'SPLIT' | 'REVERSE_SPLIT' | 'MERGER' | 'DELISTING' | 'LISTING' | 'HALT' | 'RESUME'

export interface CorporateEventSource {
  provider: string
  reference: string
}

interface CorporateEventBase {
  id: string
  assetId: string
  date: string
  timing: CorporateEventTiming
  type: CorporateEventType
  title: string
  summary: string
  important: boolean
  source: CorporateEventSource
}

export interface DividendCorporateEvent extends CorporateEventBase {
  type: 'DIVIDEND'
  payload: {
    cashPerShare: number
    currency: AssetCurrency
    withholdingRate: number
  }
}

export interface SplitCorporateEvent extends CorporateEventBase {
  type: 'SPLIT' | 'REVERSE_SPLIT'
  payload: {
    numerator: number
    denominator: number
    cashInLieuPrice?: number
  }
}

export interface MergerCorporateEvent extends CorporateEventBase {
  type: 'MERGER'
  payload: {
    targetAssetId?: string
    targetMarket?: MarketCode
    targetCurrency?: AssetCurrency
    shareNumerator?: number
    shareDenominator?: number
    cashPerShare?: number
    cashInLieuPrice?: number
  }
}

export interface DelistingCorporateEvent extends CorporateEventBase {
  type: 'DELISTING'
  payload: {
    cashOutPerShare?: number
  }
}

export interface StatusCorporateEvent extends CorporateEventBase {
  type: 'LISTING' | 'HALT' | 'RESUME'
  payload: Record<string, never>
}

export type CorporateEvent = DividendCorporateEvent | SplitCorporateEvent | MergerCorporateEvent | DelistingCorporateEvent | StatusCorporateEvent

export interface CorporateEventDataset {
  schemaVersion: number
  coverage: { from: string; to: string }
  source: {
    mode: 'empty-seed' | 'curated-partial' | 'generated'
    generatedAt: string | null
  }
  events: CorporateEvent[]
}

export interface AssetRestriction {
  halted: boolean
  delisted: boolean
}

export interface CorporateActionRecord {
  eventId: string
  assetId: string
  date: string
  type: CorporateEventType
  timing: CorporateEventTiming
  title: string
  summary: string
  note: string
  cashDelta: number
  quantityBefore: number | null
  quantityAfter: number | null
}

export interface CorporateActionState {
  krwCash: number
  usdCash: number
  positions: Position[]
  pendingOrders: MarketOrder[]
  assetRestrictions: Record<string, AssetRestriction>
  corporateHistory: CorporateActionRecord[]
  pendingImportantEvents: CorporateActionRecord[]
}

export interface CorporateActionProcessResult {
  state: CorporateActionState
  records: CorporateActionRecord[]
}
