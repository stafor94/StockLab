import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  applyMarketEventsToSessions,
  getKstGameDate,
  getKstStartOfDayTimestamp,
  type MarketEvent,
} from '../game/calendar/marketTimeline'
import {
  findFirstImportantCorporateStopDate,
  processCorporateEventsToDate,
} from '../game/corporate/corporateEngine'
import type { CorporateEvent } from '../game/corporate/types'
import { executeExchange } from '../game/exchange/exchangeEngine'
import type { ExchangeRequest } from '../game/exchange/types'
import { countLoanPaymentFailures } from '../game/loan/loanAttention'
import { processLoanToDate, repayLoanPrincipal as executeLoanRepayment } from '../game/loan/loanEngine'
import type { LoanAdvanceContext } from '../game/loan/types'
import { findFirstImportantNewsStopDate, getImportantNewsRecordsBetween } from '../game/news/newsEngine'
import type { NewsItem } from '../game/news/types'
import {
  createInitialSave,
  migrateGameSave,
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  type FirstGameExperience,
  type GameSave,
  type TutorialStatus,
} from '../game/save'
import { applyDueSettlements } from '../game/settlement/settlementEngine'
import {
  executeMarketOpenOrders,
  executeSessionPriceOrder as executeImmediateSessionPriceOrder,
  validateOrderPlacement,
  validateSessionPriceOrderPlacement,
} from '../game/trading/orderEngine'
import { closeMarketSession } from '../game/trading/sessionEngine'
import type {
  MarketOpenExecutionContext,
  MarketSessionExecutionPrice,
  OrderExecutionResult,
  QueueOrderInput,
  TradeExecution,
} from '../game/trading/types'

export interface QueueOrderResult {
  ok: boolean
  message: string
  orderId?: string
}

export interface SessionPriceOrderResult {
  ok: boolean
  message: string
  trade?: TradeExecution
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
  setTutorialStatus: (status: TutorialStatus) => void
  markGuidanceExperience: (experience: FirstGameExperience) => void
  setChecklistCollapsed: (collapsed: boolean) => void
  confirmSkipOrder: () => void
  acknowledgeLoanPaymentFailures: () => void
  advanceToDate: (gameDate: string, context: AdvanceGameContext) => AdvanceDateResult
  acknowledgeCorporateEvent: () => void
  acknowledgeImportantNews: () => void
  markNewsRead: (newsId: string) => void
  queueMarketOrder: (input: QueueOrderInput) => QueueOrderResult
  cancelMarketOrder: (orderId: string) => void
  executeMarketOpen: (event: MarketEvent, context: MarketOpenExecutionContext) => OrderExecutionResult[]
  executeSessionPriceOrder: (input: QueueOrderInput, executionPrice: number, priceSource: MarketSessionExecutionPrice, settlementDate?: string) => SessionPriceOrderResult
  closeMarket: (event: MarketEvent) => MarketSessionActionResult
  fastForwardTimeline: (events: MarketEvent[], targetTimestamp: string) => number
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

function withExperience(state: GameSave, experience: FirstGameExperience): GameSave['guidance'] {
  return state.guidance.experienced.includes(experience)
    ? state.guidance
    : { ...state.guidance, experienced: [...state.guidance.experienced, experience] }
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialSave,
      setTutorialStatus: (tutorialStatus) => set((state) => ({ guidance: { ...state.guidance, tutorialStatus } })),
      markGuidanceExperience: (experience) => set((state) => ({ guidance: withExperience(state, experience) })),
      setChecklistCollapsed: (checklistCollapsed) => set((state) => ({ guidance: { ...state.guidance, checklistCollapsed } })),
      confirmSkipOrder: () => set((state) => ({
        guidance: {
          ...withExperience(state, 'order-or-skip-confirmed'),
          skipOrderConfirmationShown: true,
        },
      })),
      acknowledgeLoanPaymentFailures: () => set((state) => ({
        guidance: {
          ...state.guidance,
          seenLoanPaymentFailures: countLoanPaymentFailures(state.loan),
        },
      })),
      advanceToDate: (requestedDate, context) => {
        const state = get()
        if (state.gameOver) return failedAdvance(state, '게임 오버 상태에서는 시간을 진행할 수 없습니다.')
        if (state.pendingImportantEvents.length > 0 || state.pendingImportantNews.length > 0) return failedAdvance(state, '중요 이벤트를 먼저 확인해야 시간을 진행할 수 있습니다.', true)
        if (requestedDate <= state.gameDate) {
          return {
            ok: true,
            message: null,
            loanEvents: 0,
            corporateEvents: 0,
            newsItems: 0,
            gameDate: state.gameDate,
            stoppedForImportantEvent: false,
            stopReason: null,
          }
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
            trades: state.trades,
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
          const dayStart = getKstStartOfDayTimestamp(gameDate)

          set({
            gameDate,
            gameTimestamp: dayStart,
            gameDisplayTimestamp: dayStart,
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
            pendingOrders: corporateOutcome.state.pendingOrders,
            guidance: withExperience(state, 'next-day-advanced'),
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
          guidance: {
            ...withExperience(state, 'order-or-skip-confirmed'),
            skipOrderConfirmationShown: true,
          },
        })
        return { ok: true, message: '개장 전 시장가 주문을 접수했습니다.', orderId: id }
      },
      cancelMarketOrder: (orderId) => set((state) => ({ pendingOrders: state.pendingOrders.filter((order) => order.id !== orderId) })),
      executeMarketOpen: (event, context) => {
        const state = get()
        if (state.gameOver || event.type !== 'OPEN' || event.market !== context.market || event.tradingDate !== context.date) return []
        const outcome = executeMarketOpenOrders(state, context)
        set({
          gameTimestamp: event.timestamp,
          gameDisplayTimestamp: event.displayTimestamp,
          gameDate: getKstGameDate(event.timestamp),
          krwCash: outcome.state.krwCash,
          usdCash: outcome.state.usdCash,
          marketSessions: outcome.state.marketSessions,
          positions: outcome.state.positions,
          pendingOrders: outcome.state.pendingOrders,
          pendingSettlements: outcome.state.pendingSettlements,
          trades: outcome.state.trades,
          guidance: withExperience(state, 'market-opened'),
        })
        return outcome.results
      },
      executeSessionPriceOrder: (input, executionPrice, priceSource, settlementDate) => {
        const state = get()
        if (state.gameOver) return { ok: false, message: '게임 오버 상태에서는 주문할 수 없습니다.' }
        const restriction = state.assetRestrictions[input.assetId]
        if (restriction?.delisted) return { ok: false, message: '상장폐지된 종목은 주문할 수 없습니다.' }
        if (restriction?.halted) return { ok: false, message: '거래정지 중인 종목은 주문할 수 없습니다.' }
        const validation = validateSessionPriceOrderPlacement(state, input, executionPrice, priceSource)
        if (validation) return { ok: false, message: validation }
        if (input.kind.startsWith('sell-') && !settlementDate) return { ok: false, message: '매도 결제일을 계산할 수 없어 주문할 수 없습니다.' }
        const tradingDate = state.marketSessions[input.market].tradingDate
        if (!tradingDate) return { ok: false, message: '현재 시장의 거래일을 확인할 수 없어 주문할 수 없습니다.' }

        const id = `O${String(state.nextOrderNumber).padStart(6, '0')}`
        const outcome = executeImmediateSessionPriceOrder(
          state,
          { ...input, id, tradeDate: tradingDate },
          {
            date: tradingDate,
            price: executionPrice,
            priceSource,
            settlementDate,
          },
        )
        const priceName = priceSource === 'open' ? '시가' : '종가'
        if (outcome.result.status !== 'filled' || !outcome.result.trade) {
          return { ok: false, message: `${priceName} 주문을 체결하지 못했습니다.` }
        }

        const trade = outcome.result.trade
        set({
          krwCash: outcome.state.krwCash,
          usdCash: outcome.state.usdCash,
          positions: outcome.state.positions,
          pendingSettlements: outcome.state.pendingSettlements,
          trades: outcome.state.trades,
          nextOrderNumber: state.nextOrderNumber + 1,
          guidance: {
            ...withExperience(state, 'order-or-skip-confirmed'),
            skipOrderConfirmationShown: true,
          },
        })
        return { ok: true, message: `오늘 ${priceName}로 ${trade.quantity}주 ${trade.side === 'buy' ? '매수' : '매도'} 체결했습니다.`, trade }
      },
      closeMarket: (event) => {
        const state = get()
        if (state.gameOver) return { ok: false, message: '게임 오버 상태에서는 장을 마감할 수 없습니다.' }
        if (event.type !== 'CLOSE') return { ok: false, message: '장 마감 이벤트가 아닙니다.' }
        try {
          const outcome = closeMarketSession(state, event.market, event.tradingDate)
          set({
            gameTimestamp: event.timestamp,
            gameDisplayTimestamp: event.displayTimestamp,
            gameDate: getKstGameDate(event.timestamp),
            marketSessions: outcome.marketSessions,
            guidance: withExperience(state, 'market-closed'),
          })
          const marketName = event.market === 'KR' ? '국내장' : '미국장'
          return { ok: true, message: `${marketName}을 마감했습니다. 해당 거래일의 공식 종가가 반영되었고 거래는 종료되었습니다.` }
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : '장 마감 처리에 실패했습니다.' }
        }
      },
      fastForwardTimeline: (events, targetTimestamp) => {
        const state = get()
        const cancelledOrders = state.pendingOrders.length
        const lastEvent = events.at(-1)
        const gameDisplayTimestamp = lastEvent?.timestamp === targetTimestamp ? lastEvent.displayTimestamp : targetTimestamp
        set({
          gameTimestamp: targetTimestamp,
          gameDisplayTimestamp,
          gameDate: getKstGameDate(targetTimestamp),
          marketSessions: applyMarketEventsToSessions(state.marketSessions, events),
          pendingOrders: [],
        })
        return cancelledOrders
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
        if (state.marketSessions.KR.phase === 'opened' || state.marketSessions.US.phase === 'opened') return { ok: false, message: '장이 열려 있는 동안에는 원금을 상환할 수 없습니다.' }
        try {
          const outcome = executeLoanRepayment({ krwCash: state.krwCash, loan: state.loan }, amount, state.gameDate)
          set({ krwCash: outcome.krwCash, loan: outcome.loan })
          return { ok: true, message: outcome.event.note }
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : '대출 상환에 실패했습니다.' }
        }
      },
      resetGame: () => set((state) => {
        const reset = createInitialSave()
        return {
          ...reset,
          guidance: {
            ...reset.guidance,
            tutorialStatus: state.guidance.tutorialStatus === 'completed' || state.guidance.tutorialStatus === 'skipped'
              ? state.guidance.tutorialStatus
              : 'not-started',
          },
        }
      }),
    }),
    {
      name: SAVE_STORAGE_KEY,
      version: SAVE_SCHEMA_VERSION,
      migrate: migrateGameSave,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        gameDate: state.gameDate,
        gameTimestamp: state.gameTimestamp,
        gameDisplayTimestamp: state.gameDisplayTimestamp,
        krwCash: state.krwCash,
        usdCash: state.usdCash,
        loan: state.loan,
        gameOver: state.gameOver,
        marketSessions: state.marketSessions,
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
        guidance: state.guidance,
      }),
    },
  ),
)
