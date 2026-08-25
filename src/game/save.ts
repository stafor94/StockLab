import {
  GAME_START_DATE,
  INITIAL_KRW_CASH,
  INITIAL_LOAN_PRINCIPAL,
  INITIAL_USD_CASH,
} from './constants'
import type { ExchangeRecord } from './exchange/types'
import type { LoanAccountState, LoanGameOverState } from './loan/types'
import type {
  MarketOrder,
  MarketSessionPhase,
  PendingSettlement,
  Position,
  TradeExecution,
} from './trading/types'

export const SAVE_STORAGE_KEY = 'stocklab.save'
export const SAVE_SCHEMA_VERSION = 4

export interface GameSave {
  schemaVersion: number
  gameDate: string
  krwCash: number
  usdCash: number
  loan: LoanAccountState
  gameOver: LoanGameOverState | null
  marketSessionPhase: MarketSessionPhase
  positions: Position[]
  pendingOrders: MarketOrder[]
  pendingSettlements: PendingSettlement[]
  trades: TradeExecution[]
  nextOrderNumber: number
  exchangeHistory: ExchangeRecord[]
  nextExchangeNumber: number
}

export function createInitialLoan(): LoanAccountState {
  return {
    principal: INITIAL_LOAN_PRINCIPAL,
    status: 'current',
    originationDate: GAME_START_DATE,
    lastProcessedDate: GAME_START_DATE,
    accruedInterest: 0,
    pastDueInterest: 0,
    overdueCharge: 0,
    pastDueSince: null,
    consecutiveMissedMonths: 0,
    history: [],
    nextEventNumber: 1,
  }
}

export function createInitialSave(): GameSave {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameDate: GAME_START_DATE,
    krwCash: INITIAL_KRW_CASH,
    usdCash: INITIAL_USD_CASH,
    loan: createInitialLoan(),
    gameOver: null,
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type LegacySave = Partial<GameSave> & {
  loanPrincipal?: number
  loanStatus?: 'current' | 'overdue' | 'paid'
  consecutiveMissedInterestMonths?: number
}

function migrateLoan(saved: LegacySave, initial: LoanAccountState): LoanAccountState {
  const raw: Record<string, unknown> = isObject(saved.loan) ? saved.loan : {}
  const status = raw.status === 'overdue' || raw.status === 'paid' ? raw.status : (saved.loanStatus ?? 'current')
  return {
    principal: finiteNumber(raw.principal, finiteNumber(saved.loanPrincipal, initial.principal)),
    status,
    originationDate: typeof raw.originationDate === 'string' ? raw.originationDate : initial.originationDate,
    lastProcessedDate: typeof raw.lastProcessedDate === 'string' ? raw.lastProcessedDate : (typeof saved.gameDate === 'string' ? saved.gameDate : initial.lastProcessedDate),
    accruedInterest: finiteNumber(raw.accruedInterest, 0),
    pastDueInterest: finiteNumber(raw.pastDueInterest, 0),
    overdueCharge: finiteNumber(raw.overdueCharge, 0),
    pastDueSince: typeof raw.pastDueSince === 'string' ? raw.pastDueSince : null,
    consecutiveMissedMonths: finiteNumber(raw.consecutiveMissedMonths, finiteNumber(saved.consecutiveMissedInterestMonths, 0)),
    history: Array.isArray(raw.history) ? raw.history as LoanAccountState['history'] : [],
    nextEventNumber: finiteNumber(raw.nextEventNumber, 1),
  }
}

export function migrateGameSave(persistedState: unknown, _persistedVersion: number): GameSave {
  const initial = createInitialSave()
  if (!persistedState || typeof persistedState !== 'object') return initial
  const saved = persistedState as LegacySave
  const rawGameOver = isObject(saved.gameOver) ? saved.gameOver : null
  const gameOver: LoanGameOverState | null = rawGameOver
    && typeof rawGameOver.date === 'string'
    && rawGameOver.reason === 'THREE_MONTHS_INTEREST_OVERDUE'
    ? { date: rawGameOver.date, reason: 'THREE_MONTHS_INTEREST_OVERDUE' }
    : null

  return {
    ...initial,
    gameDate: typeof saved.gameDate === 'string' ? saved.gameDate : initial.gameDate,
    krwCash: finiteNumber(saved.krwCash, initial.krwCash),
    usdCash: finiteNumber(saved.usdCash, initial.usdCash),
    loan: migrateLoan(saved, initial.loan),
    gameOver,
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
