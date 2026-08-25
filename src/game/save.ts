import {
  GAME_START_DATE,
  INITIAL_KRW_CASH,
  INITIAL_LOAN_PRINCIPAL,
  INITIAL_USD_CASH,
} from './constants'
import type { ExchangeRecord } from './exchange/types'
import type {
  MarketOrder,
  MarketSessionPhase,
  PendingSettlement,
  Position,
  TradeExecution,
} from './trading/types'

export const SAVE_STORAGE_KEY = 'stocklab.save'
export const SAVE_SCHEMA_VERSION = 3

export type LoanStatus = 'current' | 'overdue' | 'paid'

export interface GameSave {
  schemaVersion: number
  gameDate: string
  krwCash: number
  usdCash: number
  loanPrincipal: number
  loanStatus: LoanStatus
  consecutiveMissedInterestMonths: number
  marketSessionPhase: MarketSessionPhase
  positions: Position[]
  pendingOrders: MarketOrder[]
  pendingSettlements: PendingSettlement[]
  trades: TradeExecution[]
  nextOrderNumber: number
  exchangeHistory: ExchangeRecord[]
  nextExchangeNumber: number
}

export function createInitialSave(): GameSave {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameDate: GAME_START_DATE,
    krwCash: INITIAL_KRW_CASH,
    usdCash: INITIAL_USD_CASH,
    loanPrincipal: INITIAL_LOAN_PRINCIPAL,
    loanStatus: 'current',
    consecutiveMissedInterestMonths: 0,
    marketSessionPhase: 'preopen',
    positions: [],
    pendingOrders: [],
    pendingSettlements: [],
    trades: [],
    nextOrderNumber: 1,
    exchangeHistory: [],
    nextExchangeNumber: 1,
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function migrateGameSave(persistedState: unknown, _persistedVersion: number): GameSave {
  const initial = createInitialSave()
  if (!persistedState || typeof persistedState !== 'object') return initial
  const saved = persistedState as Partial<GameSave>

  return {
    ...initial,
    gameDate: typeof saved.gameDate === 'string' ? saved.gameDate : initial.gameDate,
    krwCash: finiteNumber(saved.krwCash, initial.krwCash),
    usdCash: finiteNumber(saved.usdCash, initial.usdCash),
    loanPrincipal: finiteNumber(saved.loanPrincipal, initial.loanPrincipal),
    loanStatus: saved.loanStatus === 'overdue' || saved.loanStatus === 'paid' ? saved.loanStatus : 'current',
    consecutiveMissedInterestMonths: finiteNumber(saved.consecutiveMissedInterestMonths, initial.consecutiveMissedInterestMonths),
    marketSessionPhase: saved.marketSessionPhase === 'opened' ? 'opened' : 'preopen',
    positions: Array.isArray(saved.positions) ? saved.positions : [],
    pendingOrders: Array.isArray(saved.pendingOrders) ? saved.pendingOrders : [],
    pendingSettlements: Array.isArray(saved.pendingSettlements) ? saved.pendingSettlements : [],
    trades: Array.isArray(saved.trades) ? saved.trades : [],
    nextOrderNumber: finiteNumber(saved.nextOrderNumber, initial.nextOrderNumber),
    exchangeHistory: Array.isArray(saved.exchangeHistory) ? saved.exchangeHistory : [],
    nextExchangeNumber: finiteNumber(saved.nextExchangeNumber, initial.nextExchangeNumber),
    schemaVersion: SAVE_SCHEMA_VERSION,
  }
}
