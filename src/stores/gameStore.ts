import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { executeExchange } from '../game/exchange/exchangeEngine'
import type { ExchangeRequest } from '../game/exchange/types'
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

interface GameStore extends GameSave {
  advanceToDate: (gameDate: string) => void
  queueMarketOrder: (input: QueueOrderInput) => QueueOrderResult
  cancelMarketOrder: (orderId: string) => void
  executeMarketOpen: (context: MarketOpenExecutionContext) => OrderExecutionResult[]
  exchangeCash: (request: ExchangeRequest, referenceRate: number) => ExchangeActionResult
  resetGame: () => void
}

const initialSave = createInitialSave()

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialSave,
      advanceToDate: (gameDate) => set((state) => {
        const settlement = applyDueSettlements(state, gameDate)
        return {
          gameDate,
          krwCash: settlement.krwCash,
          usdCash: settlement.usdCash,
          pendingSettlements: settlement.pendingSettlements,
          pendingOrders: [],
          marketSessionPhase: 'preopen',
        }
      }),
      queueMarketOrder: (input) => {
        const state = get()
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
        loanPrincipal: state.loanPrincipal,
        loanStatus: state.loanStatus,
        consecutiveMissedInterestMonths: state.consecutiveMissedInterestMonths,
        marketSessionPhase: state.marketSessionPhase,
        positions: state.positions,
        pendingOrders: state.pendingOrders,
        pendingSettlements: state.pendingSettlements,
        trades: state.trades,
        nextOrderNumber: state.nextOrderNumber,
        exchangeHistory: state.exchangeHistory,
        nextExchangeNumber: state.nextExchangeNumber,
      }),
    },
  ),
)
