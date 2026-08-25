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
import { findFirstImportantNewsStopDate, getImportantNewsRecordsBetween } from '../game/news/newsEngine'
import type { NewsItem } from '../game/news/types'
import {
  createInitialSave,
  migrateGameSave,
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  type GameSave,
} from '../game/save'
import { applyDueSettlements } from '../game/settlement/settlementEngine'
import { executeMarketOpenOrders, validateOrderPlacement } from '../game/trading/orderEngine'
import { canAdvanceFromSession, closeMarketSession } from '../game/trading/sessionEngine'
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
  newsItems: NewsItem[]
  gameDates: string[]
}

export type TimelineStopReason = 'corporate' | 'news' | 'loan' | 'game-over' | null

export interface AdvanceDateResult {
  ok: boolean
  message: string | null
  loanEvents: number
  corporateEvents: number
  newsItems: number
  gameDate: string
  stoppedForImportantEvent: boolean
  stopReason: TimelineStopReason
}

export interface LoanRepaymentResult {
  ok: boolean
  message: string
}

export interface MarketSessionActionResult {
  ok: boolean
  message: string
}

interface GameStore extends GameSave {
  advanceToDate: (gameDate: string, context: AdvanceGameContext) => AdvanceDateResult
  acknowledgeCorporateEvent: () => void
  acknowledgeImportantNews: () => void
  markNewsRead: (newsId: string) => void
  queueMarketOrder: (input: QueueOrderInput) => QueueOrderResult
  cancelMarketOrder: (orderId: string) => void
  executeMarketOpen: (context: MarketOpenExecutionContext) => OrderExecutionResult[]
  closeMarket: () => MarketSessionActionResult
  exchangeCash: (request: ExchangeRequest, referenceRate: number) => ExchangeActionResult
  repayLoanPrincipal: (amount: number) => LoanRepaymentResult
  resetGame: () => void
}

const initialSave = createInitialSave()
const failedAdvance = (state: GameSave, message: string, blocked = false): AdvanceDateResult => ({
  ok: false,
  message,
  loanEvents: 0,
  corporateEvents: 0,
  newsItems: 0,
  gameDate: state.gameDate,
  stoppedForImportantEvent: blocked,
  stopReason: null,
})

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialSave,
      advanceToDate: (requestedDate, context) => {
        const state = get()
        if (state.gameOver) return failedAdvance(state, '게임 오버 상태에서는 시간을 진행할 수 없습니다.')
        if (state.pendingImportantEvents.length > 0 || state.pendingImportantNews.length > 0) return failedAdvance(state, '중요 이벤트를 먼저 확인해야 시간을 진행할 수 있습니다.', true)
        if (!canAdvanceFromSession(context.gameDates.includes(state.gameDate), state.marketSessionPhase)) {
          return failedAdvance(state, '현재 거래일의 장을 시작하고 마감한 뒤 다음 날짜로 진행할 수 있습니다.')
        }
        try {
          const processedCorporate = new Set(state.corporateHistory.map((record) => record.eventId))
          const corporateStopDate = findFirstImportantCorporateStopDate(state.gameDate, requestedDate, context.corporateEvents, processedCorporate, context.gameDates)
          const handledNews = new Set(state.readNewsIds)
          const newsStopDate = findFirstImportantNewsStopDate(state.gameDate, requestedDate, context.newsItems, handledNews, context.gameDates)
          const stopDate = [corporateStopDate, newsStopDate].filter((date): date is string => Boolean(date)).sort()[0] ?? null
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
          const importantNews = getImportantNewsRecordsBetween(state.gameDate, gameDate, context.newsItems, handledNews, context.gameDates)
          const loanOutcome = processLoanToDate({
            krwCash: corporateOutcome.state.krwCash,
            loan: state.loan,
            gameOver: state.gameOver,
          }, gameDate, context)
          const loanFailed = loanOutcome.events.some((event) => event.type === 'payment_failed')
          const stopReason: TimelineStopReason = loanOutcome.gameOver
            ? 'game-over'
            : loanFailed
              ? 'loan'
              : corporateStopDate === gameDate
                ? 'corporate'
                : newsStopDate === gameDate
                  ? 'news'
                  : null

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
            pendingImportantNews: [...state.pendingImportantNews, ...importantNews],
            pendingSettlements: settlement.pendingSettlements,
            pendingOrders: [],
            marketSessionPhase: 'preopen',
          })
          const corporateNote = corporateOutcome.records.at(-1)?.note
          const newsNote = importantNews.at(0)?.headline
          const loanNote = loanOutcome.events.at(-1)?.note
          return {
            ok: true,
            message: corporateNote ?? newsNote ?? loanNote ?? null,
            loanEvents: loanOutcome.events.length,
            corporateEvents: corporateOutcome.records.length,
            newsItems: importantNews.length,
            gameDate,
            stoppedForImportantEvent: stopReason !== null,
            stopReason,
          }
        } catch (error) {
          return {
            ...failedAdvance(state, error instanceof Error ? error.message : '날짜 진행 중 게임 이벤트 계산에 실패했습니다.'),
            stopReason: null,
          }
        }
      },
      acknowledgeCorporateEvent: () => set((state) => ({ pendingImportantEvents: state.pendingImportantEvents.slice(1) })),
      acknowledgeImportantNews: () => set((state) => {
        const current = state.pendingImportantNews[0]
        if (!current) return {}
        return {
          pendingImportantNews: state.pendingImportantNews.slice(1),
          readNewsIds: state.readNewsIds.includes(current.newsId) ? state.readNewsIds : [...state.readNewsIds, current.newsId],
        }
      }),
      markNewsRead: (newsId) => set((state) => ({ readNewsIds: state.readNewsIds.includes(newsId) ? state.readNewsIds : [...state.readNewsIds, newsId] })),
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
      cancelMarketOrder: (orderId) => set((state) => ({ pendingOrders: state.pendingOrders.filter((order) => order.id !== orderId) })),
      executeMarketOpen: (context) => {
        if (get().gameOver || get().marketSessionPhase !== 'preopen') return []
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
      closeMarket: () => {
        const state = get()
        if (state.gameOver) return { ok: false, message: '게임 오버 상태에서는 장을 마감할 수 없습니다.' }
        try {
          const outcome = closeMarketSession(state)
          set({ marketSessionPhase: outcome.marketSessionPhase })
          return { ok: true, message: outcome.marketSessionPhase === 'closed' ? '오늘 장을 마감했습니다. 당일 OHLC가 공개됩니다.' : '장 마감 상태입니다.' }
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : '장 마감 처리에 실패했습니다.' }
        }
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
        readNewsIds: state.readNewsIds,
        pendingImportantNews: state.pendingImportantNews,
      }),
    },
  ),
)
