import {
  GAME_START_DATE,
  GAME_START_TIMESTAMP,
  INITIAL_KRW_CASH,
  INITIAL_LOAN_PRINCIPAL,
  INITIAL_USD_CASH,
} from './constants'
import type { CorporateActionRecord, AssetRestriction } from './corporate/types'
import type { ExchangeRecord } from './exchange/types'
import type { LoanAccountState, LoanGameOverState } from './loan/types'
import type { ImportantNewsRecord } from './news/types'
import type {
  MarketOrder,
  MarketSessionPhase,
  MarketSessionStates,
  PendingSettlement,
  Position,
  TradeExecution,
} from './trading/types'

export const SAVE_STORAGE_KEY = 'stocklab.save'
export const SAVE_SCHEMA_VERSION = 12

export type TutorialStatus = 'not-started' | 'completed' | 'skipped'
export type FirstGameExperience =
  | 'market-visited'
  | 'asset-detail-viewed'
  | 'order-or-skip-confirmed'
  | 'market-opened'
  | 'market-closed'
  | 'next-day-advanced'

export interface GuidanceSave {
  tutorialStatus: TutorialStatus
  experienced: FirstGameExperience[]
  checklistCollapsed: boolean
  skipOrderConfirmationShown: boolean
  seenLoanPaymentFailures: number
}

export interface GameSave {
  schemaVersion: number
  gameDate: string
  gameTimestamp: string
  gameDisplayTimestamp: string
  krwCash: number
  usdCash: number
  loan: LoanAccountState
  gameOver: LoanGameOverState | null
  marketSessions: MarketSessionStates
  positions: Position[]
  pendingOrders: MarketOrder[]
  pendingSettlements: PendingSettlement[]
  trades: TradeExecution[]
  nextOrderNumber: number
  exchangeHistory: ExchangeRecord[]
  nextExchangeNumber: number
  assetRestrictions: Record<string, AssetRestriction>
  corporateHistory: CorporateActionRecord[]
  pendingImportantEvents: CorporateActionRecord[]
  readNewsIds: string[]
  pendingImportantNews: ImportantNewsRecord[]
  guidance: GuidanceSave
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

function initialMarketSessions(): MarketSessionStates {
  return {
    KR: { phase: 'preopen', tradingDate: null },
    US: { phase: 'preopen', tradingDate: null },
  }
}

export function createInitialSave(): GameSave {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameDate: GAME_START_DATE,
    gameTimestamp: GAME_START_TIMESTAMP,
    gameDisplayTimestamp: GAME_START_TIMESTAMP,
    krwCash: INITIAL_KRW_CASH,
    usdCash: INITIAL_USD_CASH,
    loan: createInitialLoan(),
    gameOver: null,
    marketSessions: initialMarketSessions(),
    positions: [],
    pendingOrders: [],
    pendingSettlements: [],
    trades: [],
    nextOrderNumber: 1,
    exchangeHistory: [],
    nextExchangeNumber: 1,
    assetRestrictions: {},
    corporateHistory: [],
    pendingImportantEvents: [],
    readNewsIds: [],
    pendingImportantNews: [],
    guidance: {
      tutorialStatus: 'not-started',
      experienced: [],
      checklistCollapsed: false,
      skipOrderConfirmationShown: false,
      seenLoanPaymentFailures: 0,
    },
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

type LegacySave = Partial<Omit<GameSave, 'marketSessions' | 'gameTimestamp' | 'gameDisplayTimestamp'>> & {
  marketSessionPhase?: MarketSessionPhase
  marketSessions?: unknown
  gameTimestamp?: unknown
  gameDisplayTimestamp?: unknown
  loanPrincipal?: number
  loanStatus?: 'current' | 'overdue' | 'paid'
  consecutiveMissedInterestMonths?: number
  tutorialStatus?: 'pending' | 'completed' | 'skipped'
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

function migrateTrade(value: unknown): TradeExecution | null {
  if (!isObject(value)) return null
  const commission = finiteNumber(value.commission, 0)
  const transactionTax = finiteNumber(value.transactionTax, 0)
  const ruralSpecialTax = finiteNumber(value.ruralSpecialTax, 0)
  const secSection31Fee = finiteNumber(value.secSection31Fee, 0)
  const finraTaf = finiteNumber(value.finraTaf, 0)
  const fallbackTotalFees = commission + transactionTax + ruralSpecialTax + secSection31Fee + finraTaf
  return {
    ...(value as unknown as TradeExecution),
    commission,
    transactionTax,
    ruralSpecialTax,
    secSection31Fee,
    finraTaf,
    totalFees: finiteNumber(value.totalFees, fallbackTotalFees),
    costBasis: nullableFiniteNumber(value.costBasis),
    realizedPnl: nullableFiniteNumber(value.realizedPnl),
  }
}

function migrateRestrictions(value: unknown): Record<string, AssetRestriction> {
  if (!isObject(value)) return {}
  const output: Record<string, AssetRestriction> = {}
  for (const [assetId, raw] of Object.entries(value)) {
    if (!isObject(raw)) continue
    output[assetId] = { halted: raw.halted === true, delisted: raw.delisted === true }
  }
  return output
}

function migrateStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
}

function migrateImportantNews(value: unknown): ImportantNewsRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ImportantNewsRecord => isObject(item)
    && typeof item.newsId === 'string'
    && typeof item.publishedDate === 'string'
    && typeof item.revealDate === 'string'
    && typeof item.headline === 'string'
    && typeof item.summary === 'string') as ImportantNewsRecord[]
}

function migrateSessionPhase(value: unknown): MarketSessionPhase {
  if (value === 'opened' || value === 'closed') return value
  return 'preopen'
}

function migrateMarketSession(value: unknown) {
  if (!isObject(value)) return null
  const phase = migrateSessionPhase(value.phase)
  const tradingDate = typeof value.tradingDate === 'string' ? value.tradingDate : null
  return { phase, tradingDate }
}

function migrateMarketSessions(value: unknown, gameDate: string, legacyPhase: MarketSessionPhase): MarketSessionStates {
  if (isObject(value)) {
    const kr = migrateMarketSession(value.KR)
    const us = migrateMarketSession(value.US)
    if (kr && us) return { KR: kr, US: us }
  }

  return {
    KR: legacyPhase === 'preopen'
      ? { phase: 'preopen', tradingDate: null }
      : { phase: legacyPhase, tradingDate: gameDate },
    US: { phase: 'preopen', tradingDate: null },
  }
}

function legacyGameTimestamps(gameDate: string, phase: MarketSessionPhase): { timeline: string; display: string } {
  const timelineTime = phase === 'opened' ? '09:00:00' : phase === 'closed' ? '15:30:00' : '00:00:00'
  const displayTime = phase === 'closed' ? '15:29:00' : timelineTime
  return {
    timeline: new Date(`${gameDate}T${timelineTime}+09:00`).toISOString(),
    display: new Date(`${gameDate}T${displayTime}+09:00`).toISOString(),
  }
}

const firstGameExperiences = new Set<FirstGameExperience>([
  'market-visited',
  'asset-detail-viewed',
  'order-or-skip-confirmed',
  'market-opened',
  'market-closed',
  'next-day-advanced',
])

function migrateGuidance(value: unknown, legacyTutorialStatus: unknown): GuidanceSave {
  const raw = isObject(value) ? value : {}
  const rawStatus = raw.tutorialStatus ?? legacyTutorialStatus
  const tutorialStatus: TutorialStatus = rawStatus === 'completed' || rawStatus === 'skipped' ? rawStatus : 'not-started'
  const experienced = Array.isArray(raw.experienced)
    ? [...new Set(raw.experienced.filter((item): item is FirstGameExperience => typeof item === 'string' && firstGameExperiences.has(item as FirstGameExperience)))]
    : []
  return {
    tutorialStatus,
    experienced,
    checklistCollapsed: raw.checklistCollapsed === true || raw.checklistDismissed === true,
    skipOrderConfirmationShown: raw.skipOrderConfirmationShown === true,
    seenLoanPaymentFailures: Math.max(0, Math.floor(finiteNumber(raw.seenLoanPaymentFailures, 0))),
  }
}

export function migrateGameSave(persistedState: unknown, _persistedVersion: number): GameSave {
  const initial = createInitialSave()
  if (!persistedState || typeof persistedState !== 'object') return initial
  const saved = persistedState as LegacySave
  const gameDate = typeof saved.gameDate === 'string' ? saved.gameDate : initial.gameDate
  const legacyPhase = migrateSessionPhase(saved.marketSessionPhase)
  const legacyTimestamps = legacyGameTimestamps(gameDate, legacyPhase)
  const gameTimestamp = validTimestamp(saved.gameTimestamp) ? saved.gameTimestamp : legacyTimestamps.timeline
  const gameDisplayTimestamp = validTimestamp(saved.gameDisplayTimestamp) ? saved.gameDisplayTimestamp : gameTimestamp === legacyTimestamps.timeline ? legacyTimestamps.display : gameTimestamp
  const rawGameOver = isObject(saved.gameOver) ? saved.gameOver : null
  const gameOver: LoanGameOverState | null = rawGameOver
    && typeof rawGameOver.date === 'string'
    && rawGameOver.reason === 'THREE_MONTHS_INTEREST_OVERDUE'
    ? { date: rawGameOver.date, reason: 'THREE_MONTHS_INTEREST_OVERDUE' }
    : null

  return {
    ...initial,
    gameDate,
    gameTimestamp,
    gameDisplayTimestamp,
    krwCash: finiteNumber(saved.krwCash, initial.krwCash),
    usdCash: finiteNumber(saved.usdCash, initial.usdCash),
    loan: migrateLoan(saved, initial.loan),
    gameOver,
    marketSessions: migrateMarketSessions(saved.marketSessions, gameDate, legacyPhase),
    positions: Array.isArray(saved.positions) ? saved.positions : [],
    pendingOrders: Array.isArray(saved.pendingOrders) ? saved.pendingOrders : [],
    pendingSettlements: Array.isArray(saved.pendingSettlements) ? saved.pendingSettlements : [],
    trades: Array.isArray(saved.trades) ? saved.trades.map(migrateTrade).filter((trade): trade is TradeExecution => trade !== null) : [],
    nextOrderNumber: finiteNumber(saved.nextOrderNumber, initial.nextOrderNumber),
    exchangeHistory: Array.isArray(saved.exchangeHistory) ? saved.exchangeHistory : [],
    nextExchangeNumber: finiteNumber(saved.nextExchangeNumber, initial.nextExchangeNumber),
    assetRestrictions: migrateRestrictions(saved.assetRestrictions),
    corporateHistory: Array.isArray(saved.corporateHistory) ? saved.corporateHistory as CorporateActionRecord[] : [],
    pendingImportantEvents: Array.isArray(saved.pendingImportantEvents) ? saved.pendingImportantEvents as CorporateActionRecord[] : [],
    readNewsIds: migrateStringArray(saved.readNewsIds),
    pendingImportantNews: migrateImportantNews(saved.pendingImportantNews),
    guidance: migrateGuidance(saved.guidance, saved.tutorialStatus),
    schemaVersion: SAVE_SCHEMA_VERSION,
  }
}
