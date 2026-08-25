import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  findFirstImportantCorporateStopDate,
  processCorporateEventsToDate,
} from '../game/corporate/corporateEngine'
import type { CorporateEvent } from '../game/corporate/types'
import { executeExchange } from '../game/exchange/exchangeEngine'
import type { ExchangeRequest } from '../game/exchange/types'
import { processLoanToDate, repayLoanPrincipal as executeLoanRepayment } from '../game/loan/loanEngine'
import type { LoanAdvanceContext } from '../game/loan/types'
import {
  createInitialSave,
  migrateGameSave,
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  type GameSave,
} from '../game/save'
import { applyDueSettlements } from '../game/settlement/settlementEngine'
import { executeMarketOpenOrders, validateOrderPlacement } from '../game/trading/orderEngine'
import type {
  MarketOpenExecutionContext,
  OrderExecutionResult,
  QueueOrderInput,
} from '../game/trading/types'

export interface QueueOrderResult {
  ok: boolean
  message: string
  orderId?: string
}

export interface ExchangeActionResult {
  ok: boolean
  message: string
  recordId?: string
}

export interface AdvanceGameContext extends LoanAdvanceContext {
  corporateEvents: CorporateEvent[]
  gameDates: string[]
}

export interface AdvanceDateResult {
  ok: boolean
  message: string | null
  loanEvents: number
  corporateEvents: number
  gameDate: string
  stoppedForImportantEvent: boolean
}

export interface LoanRepaymentResult {
  ok: boolean
  message: string
}

interface GameStore extends GameSave {
  advanceToDate: (gameDate: string, context: AdvanceGameContext) => AdvanceDateResult
  acknowledgeCorporateEvent: () => void
  queueMarketOrder: (input: QueueOrderInput) => QueueOrderResult
  cancelMarketOrder: (orderId: string) => void
  executeMarketOpen: (context: MarketOpenExecutionContext) => OrderExecutionResult[]
  exchangeCash: (request: ExchangeRequest, referenceRate: number) => ExchangeActionResult
  repayLoanPrincipal: (amount: number) => LoanRepaymentResult
  resetGame: () => void
}

const initialSave = createInitialSave()

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialSave,
      advanceToDate: (requestedDate, context) => {
        const state = get()
        if (state.gameOver) return { ok: false, message: '게임 오버 상태에서는 시간을 진행할 수 없습니다.', loanEvents: 0, corporateEvents: 0, gameDate: state.gameDate, stoppedForImportantEvent: false }
        if (state.pendingImportantEvents.length > 0) return { ok: false, message: '중요 이벤트를 먼저 확인해야 시간을 진행할 수 있습니다.', loanEvents: 0, corporateEvents: 0, gameDate: state.gameDate, stoppedForImportantEvent: true }
        try {
          const processed = new Set(state.corporateHistory.map((record) => record.eventId))
          const stopDate = findFirstImportantCorporateStopDate(state.gameDate, requestedDate, context.corporateEvents, processed, context.gameDates)
          const gameDate = stopDate ?? requestedDate
          const settlement = applyDueSettlements(state, gameDate)
          const corporateOutcome = processCorporateEventsToDate({
            krwCash: settlement.krwCash,
            usdCash: settlement.usdCash,
            positions: state.positions,
            pendingOrders: state.pendingOrders,
            assetRestrictions: state.assetRestrictions,
            corporateHistory: state.corporateHistory,
            pendingImportantEvents: state.pendingImportantEvents,
          }, state.gameDate, gameDate, context.corporateEvents, context.gameDates)
          const loanOutcome = processLoanToDate({
            krwCash: corporateOutcome.state.krwCash,
            loan: state.loan,
            gameOver: state.gameOver,
          }, gameDate, context)
          set({
            gameDate,
            krwCash: loanOutcome.krwCash,
            usdCash: corporateOutcome.state.usdCash,
            loan: loanOutcome.loan,
            gameOver: loanOutcome.gameOver,
            positions: corporateOutcome.state.positions,
            assetRestrictions: corporateOutcome.state.assetRestrictions,
            corporateHistory: corporateOutcome.state.corporateHistory,
            pendingImportantEvents: corporateOutcome.state.pendingImportantEvents,
            pendingSettlements: settlement.pendingSettlements,
            pendingOrders: [],
            marketSessionPhase: 'preopen',
          })
          const corporateNote = corporateOutcome.records.at(-1)?.note
          const loanNote = loanOutcome.events.at(-1)?.note
          return {
            ok: true,
            message: corporateNote ?? loanNote ?? null,
            loanEvents: loanOutcome.events.length,
            corporateEvents: corporateOutcome.records.length,
            gameDate,
            stoppedForImportantEvent: Boolean(stopDate),
          }
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : '날짜 진행 중 게임 이벤트 계산에 실패했습니다.',
            loanEvents: 0,
            corporateEvents: 0,
            gameDate: state.gameDate,
            stoppedForImportantEvent: false,
          }
        }
      },
      acknowledgeCorporateEvent: () => set((state) => ({ pendingImportantEvents: state.pendingImportantEvents.slice(1) })),
      queueMarketOrder: (input) => {
        const state = get()
        if (state.gameOver) return { ok: false, message: '게임 오버 상태에서는 주문할 수 없습니다.' }
        const restriction = state.assetRestrictions[input.assetId]
        if (restriction?.delisted) return { ok: false, message: '상장폐지된 종목은 주문할 수 없습니다.' }
        if (restriction?.halted) return { ok: false, message: '거래정지 중인 종목은 주문할 수 없습니다.' }
        const validation = validateOrderPlacement(state, input)
        if (validation) return { ok: false, message: validation }
        const id = `O${String(state.nextOrderNumber).padStart(6, '0')}`
        set({
          pendingOrders: [...state.pendingOrders, { ...input, id, tradeDate: state.gameDate }],
          nextOrderNumber: state.nextOrderNumber + 1,
        })
        return { ok: true, message: '개장 전 시장가 주문을 접수했습니다.', orderId: id }
      },
      cancelMarketOrder: (orderId) => set((state) => ({
        pendingOrders: state.pendingOrders.filter((order) => order.id !== orderId),
      })),
      executeMarketOpen: (context) => {
        if (get().gameOver) return []
        const outcome = executeMarketOpenOrders(get(), context)
        set({
          krwCash: outcome.state.krwCash,
          usdCash: outcome.state.usdCash,
          marketSessionPhase: outcome.state.marketSessionPhase,
          positions: outcome.state.positions,
          pendingOrders: outcome.state.pendingOrders,
          pendingSettlements: outcome.state.pendingSettlements,
          trades: outcome.state.trades,
        })
        return outcome.results
      },
      exchangeCash: (request, referenceRate) => {
        if (get().gameOver) return { ok: false, message: '게임 오버 상태에서는 환전할 수 없습니다.' }
        try {
          const outcome = executeExchange(get(), request, referenceRate, get().gameDate)
          set({
            krwCash: outcome.state.krwCash,
            usdCash: outcome.state.usdCash,
            exchangeHistory: outcome.state.exchangeHistory,
            nextExchangeNumber: outcome.state.nextExchangeNumber,
          })
          return { ok: true, message: '환전이 완료되었습니다.', recordId: outcome.record.id }
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : '환전에 실패했습니다.' }
        }
      },
      repayLoanPrincipal: (amount) => {
        const state = get()
        if (state.gameOver) return { ok: false, message: '게임 오버 상태에서는 상환할 수 없습니다.' }
        if (state.marketSessionPhase !== 'preopen') return { ok: false, message: '원금 상환은 개장 전에만 가능합니다.' }
        try {
          const outcome = executeLoanRepayment({ krwCash: state.krwCash, loan: state.loan }, amount, state.gameDate)
          set({ krwCash: outcome.krwCash, loan: outcome.loan })
          return { ok: true, message: outcome.event.note }
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : '대출 상환에 실패했습니다.' }
        }
      },
      resetGame: () => set(createInitialSave()),
    }),
    {
      name: SAVE_STORAGE_KEY,
      version: SAVE_SCHEMA_VERSION,
      migrate: migrateGameSave,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        gameDate: state.gameDate,
        krwCash: state.krwCash,
        usdCash: state.usdCash,
        loan: state.loan,
        gameOver: state.gameOver,
        marketSessionPhase: state.marketSessionPhase,
        positions: state.positions,
        pendingOrders: state.pendingOrders,
        pendingSettlements: state.pendingSettlements,
        trades: state.trades,
        nextOrderNumber: state.nextOrderNumber,
        exchangeHistory: state.exchangeHistory,
        nextExchangeNumber: state.nextExchangeNumber,
        assetRestrictions: state.assetRestrictions,
        corporateHistory: state.corporateHistory,
        pendingImportantEvents: state.pendingImportantEvents,
      }),
    },
  ),
)
