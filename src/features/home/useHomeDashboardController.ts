import { useEffect, useMemo, useRef, useState } from 'react'
import { newsDataClient } from '../../data/newsDataClient'
import {
  advanceGameTimestamp,
  formatKstGameDate,
  formatMarketEventLabel,
  getKstGameDate,
  getKstGameTime,
  getMarketEventsBetween,
  type GameTimeStep,
  type MarketEvent,
} from '../../game/calendar/marketTimeline'
import { getNextSessionAwareMarketEvent } from '../../game/calendar/sessionAwareMarketEvent'
import { getNextLoanPaymentDate } from '../../game/loan/loanEngine'
import { getWsLoanAnnualRate } from '../../game/loan/rateRules'
import { buildMajorMarketIndexCards } from '../../game/market/marketIndexQuote'
import { getNewsRevealedOnDate } from '../../game/news/newsEngine'
import { getReturnBadge } from '../../game/portfolio/portfolioEngine'
import { useBaseRate } from '../../hooks/useBaseRate'
import { useGameStore, type AdvanceDateResult } from '../../stores/gameStore'
import { resumeGameClockAfterMarketSessionRecovery } from '../../stores/marketSessionRecovery'
import { useCorporateEvents } from '../events/useCorporateEvents'
import { useMarketCalendars } from '../market/useMarketCalendars'
import { useMarketCatalog } from '../market/useMarketCatalog'
import { useMarketIndices } from '../market/useMarketIndices'
import { useNews } from '../news/useNews'
import { usePortfolioValuation } from '../portfolio/usePortfolioValuation'
import { buildMarketOpenContext } from '../trading/buildMarketOpenContext'
import { buildAutoplayNotices, useAutoplayUiStore } from './autoplayUiStore'
import { useAutoplay, type AutoplaySpeed } from './useAutoplay'

const currency = new Intl.NumberFormat('ko-KR')
const marketLabels = { KR: 'KRX', US: '미국' } as const
const sessionLabels = { preopen: '개장 전', opened: '장중', closed: '마감' } as const
export const autoplaySpeeds: AutoplaySpeed[] = [1, 2, 5, 10, 30]

function stopReasonLabel(result: AdvanceDateResult): string {
  if (result.stopReason === 'news') return '중요 뉴스'
  if (result.stopReason === 'loan') return 'WS은행 자동출금 실패'
  if (result.stopReason === 'game-over') return '대출 연체 게임오버'
  return '중요 기업 이벤트'
}

function eventTimeLabel(event: MarketEvent): string {
  return `${formatKstGameDate(event.displayTimestamp)} ${getKstGameTime(event.displayTimestamp)}`
}

function drainAutoplayImportantContent(): number {
  const pending = useGameStore.getState()
  const pendingEvents = [...pending.pendingImportantEvents]
  const pendingNews = [...pending.pendingImportantNews]
  const notices = buildAutoplayNotices(pendingEvents, pendingNews)
  if (notices.length > 0) useAutoplayUiStore.getState().enqueueNotices(notices)
  for (let index = 0; index < pendingEvents.length; index += 1) useGameStore.getState().acknowledgeCorporateEvent()
  for (let index = 0; index < pendingNews.length; index += 1) useGameStore.getState().acknowledgeImportantNews()
  return notices.length
}

function showLatestLoanPaymentFailure(): void {
  const state = useGameStore.getState()
  const failure = [...state.loan.history].reverse().find((event) => event.type === 'payment_failed')
  if (!failure) return
  useAutoplayUiStore.getState().showLoanAlert({
    id: failure.id,
    date: failure.date,
    amount: failure.amount,
    note: failure.note,
    consecutiveMissedMonths: state.loan.consecutiveMissedMonths,
  })
}

export function useHomeDashboardController() {
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null)
  const [processingSession, setProcessingSession] = useState(false)
  const [processingTimeline, setProcessingTimeline] = useState(false)
  const processingTimelineRef = useRef(false)
  const game = useGameStore()
  const { calendars, status: calendarStatus, error: calendarError } = useMarketCalendars()
  const catalog = useMarketCatalog()
  const marketIndexState = useMarketIndices()
  const rateState = useBaseRate(game.gameDate)
  const corporateState = useCorporateEvents()
  const newsState = useNews(game.gameDate)
  const portfolio = usePortfolioValuation()

  const unsettledKrw = game.pendingSettlements.filter((item) => item.currency === 'KRW').reduce((total, item) => total + item.amount, 0)
  const unsettledUsd = game.pendingSettlements.filter((item) => item.currency === 'USD').reduce((total, item) => total + item.amount, 0)
  const totalAssets = portfolio.snapshot.grossAssetsKrw
  const netAssets = portfolio.snapshot.netWorthKrw
  const returnRate = portfolio.snapshot.strategyReturnRate
  const returnBadge = getReturnBadge(returnRate ?? 0)
  const nextMarketEvent = useMemo(
    () => calendars ? getNextSessionAwareMarketEvent(game.gameTimestamp, calendars, game.marketSessions) : null,
    [calendars, game.gameTimestamp, game.marketSessions],
  )
  const marketIndexCards = useMemo(() => buildMajorMarketIndexCards(marketIndexState.series, {
    gameDate: game.gameDate,
    marketSessions: game.marketSessions,
  }), [game.gameDate, game.marketSessions, marketIndexState.series])
  const gameDates = useMemo(() => calendars ? [...new Set([...calendars.KR.tradingDates, ...calendars.US.tradingDates])].sort() : [], [calendars])
  const nextInterestDate = useMemo(() => calendars ? getNextLoanPaymentDate(game.gameDate, game.loan.originationDate, calendars.KR.tradingDates) : null, [calendars, game.gameDate, game.loan.originationDate])
  const loanAnnualRate = useMemo(() => {
    if (rateState.status !== 'ready') return null
    try { return getWsLoanAnnualRate(rateState.series, game.gameDate) } catch { return null }
  }, [game.gameDate, rateState])
  const todayNews = useMemo(() => calendars ? getNewsRevealedOnDate(newsState.items, game.gameDate, gameDates) : [], [calendars, game.gameDate, gameDates, newsState.items])
  const todayCorporateEvents = game.corporateHistory.filter((item) => item.date === game.gameDate)

  const marketStatusLabel = calendarStatus === 'ready'
    ? (`${marketLabels.KR} ${sessionLabels[game.marketSessions.KR.phase]} · ${marketLabels.US} ${sessionLabels[game.marketSessions.US.phase]}`)
    : calendarStatus === 'error' ? '시장 일정 확인 필요' : '시장 일정 확인 중'

  const timelineReady = Boolean(calendars && rateState.status === 'ready' && rateState.baseRate !== null && corporateState.status === 'ready' && corporateState.dataset && newsState.status === 'ready')

  const advanceDateBoundary = async (requestedDate: string): Promise<AdvanceDateResult | null> => {
    if (!calendars || rateState.status !== 'ready' || !corporateState.dataset || newsState.status !== 'ready') return null
    const current = useGameStore.getState()
    if (requestedDate <= current.gameDate) {
      return {
        ok: true,
        message: null,
        loanEvents: 0,
        corporateEvents: 0,
        newsItems: 0,
        gameDate: current.gameDate,
        stoppedForImportantEvent: false,
        stopReason: null,
      }
    }
    const { items: newsItems } = await newsDataClient.loadThrough(requestedDate)
    return current.advanceToDate(requestedDate, {
      baseRates: rateState.series,
      bankBusinessDates: calendars.KR.tradingDates,
      corporateEvents: corporateState.dataset.events,
      newsItems,
      gameDates,
    })
  }

  const advanceDateBoundaryForAutoplay = async (requestedDate: string): Promise<AdvanceDateResult | null> => {
    while (true) {
      const result = await advanceDateBoundary(requestedDate)
      if (!result?.ok || !result.stoppedForImportantEvent) return result
      if (result.stopReason !== 'corporate' && result.stopReason !== 'news') return result
      if (drainAutoplayImportantContent() === 0) return result
    }
  }

  const reportStoppedAdvance = (result: AdvanceDateResult, prefix = '') => {
    setTimelineMessage(`${prefix}${stopReasonLabel(result)}로 ${result.gameDate}에서 시간 진행이 멈췄습니다.`)
  }

  const performNextEvent = async (autoplayMode = false): Promise<boolean> => {
    if (!calendars || !timelineReady || processingTimelineRef.current) return false
    const current = useGameStore.getState()
    const event = getNextSessionAwareMarketEvent(current.gameTimestamp, calendars, current.marketSessions)
    if (!event) {
      setTimelineMessage('현재 제공되는 시장 일정 범위에서 다음 이벤트가 없습니다.')
      return false
    }

    processingTimelineRef.current = true
    setProcessingSession(true)
    try {
      const eventGameDate = getKstGameDate(event.timestamp)
      if (eventGameDate > current.gameDate) {
        const result = autoplayMode
          ? await advanceDateBoundaryForAutoplay(eventGameDate)
          : await advanceDateBoundary(eventGameDate)
        if (!result?.ok) {
          setTimelineMessage(result?.message ?? '날짜 진행에 필요한 데이터를 확인할 수 없습니다.')
          return false
        }
        if (result.stoppedForImportantEvent) {
          if (autoplayMode && result.stopReason === 'loan') showLatestLoanPaymentFailure()
          reportStoppedAdvance(result)
          return false
        }
      }

      const latest = useGameStore.getState()
      if (event.type === 'OPEN') {
        const recoveringPastOpen = Date.parse(event.timestamp) < Date.parse(current.gameTimestamp)
        const orders = latest.pendingOrders.filter((order) => order.market === event.market && order.tradeDate === event.tradingDate)
        const context = await buildMarketOpenContext({ market: event.market, date: event.tradingDate, orders, assets: catalog.assets, calendars })
        const results = latest.executeMarketOpen(event, context)
        if (recoveringPastOpen) {
          resumeGameClockAfterMarketSessionRecovery(current.gameTimestamp, current.gameDisplayTimestamp)
        }
        const filled = results.filter((result) => result.status === 'filled').length
        const cancelled = results.length - filled
        const orderNote = orders.length > 0 ? ` · 예약 주문 체결 ${filled}건${cancelled > 0 ? `, 취소 ${cancelled}건` : ''}` : ''
        const recoveryNote = recoveringPastOpen ? ' · 저장된 시장 상태 복구' : ''
        setTimelineMessage(`${formatMarketEventLabel(event)} · ${eventTimeLabel(event)}${orderNote}${recoveryNote}`)
        return true
      }

      const result = latest.closeMarket(event)
      setTimelineMessage(result.ok ? `${formatMarketEventLabel(event)} · ${eventTimeLabel(event)}` : result.message)
      return result.ok
    } catch (error) {
      setTimelineMessage(error instanceof Error ? error.message : '시장 이벤트 처리에 실패했습니다.')
      return false
    } finally {
      processingTimelineRef.current = false
      setProcessingSession(false)
    }
  }

  const performAdvance = async (step: GameTimeStep): Promise<boolean> => {
    if (!calendars || !timelineReady || processingTimelineRef.current) return false
    const current = useGameStore.getState()
    const targetTimestamp = advanceGameTimestamp(current.gameTimestamp, step)
    const targetDate = getKstGameDate(targetTimestamp)
    const events = getMarketEventsBetween(current.gameTimestamp, targetTimestamp, calendars)

    processingTimelineRef.current = true
    setProcessingTimeline(true)
    try {
      const cancelledOrders = useGameStore.getState().fastForwardTimeline([], current.gameTimestamp)
      const prefix = cancelledOrders > 0 ? `미체결 주문 ${cancelledOrders}건 취소 · ` : ''

      for (const event of events) {
        const latest = useGameStore.getState()
        const eventGameDate = getKstGameDate(event.timestamp)
        if (eventGameDate > latest.gameDate) {
          const result = await advanceDateBoundary(eventGameDate)
          if (!result?.ok) {
            setTimelineMessage(result?.message ?? '날짜 진행에 필요한 데이터를 확인할 수 없습니다.')
            return false
          }
          if (result.stoppedForImportantEvent) {
            reportStoppedAdvance(result, prefix)
            return false
          }
        }
        useGameStore.getState().fastForwardTimeline([event], event.timestamp)
      }

      const latest = useGameStore.getState()
      if (targetDate > latest.gameDate) {
        const result = await advanceDateBoundary(targetDate)
        if (!result?.ok) {
          setTimelineMessage(result?.message ?? '날짜 진행에 필요한 데이터를 확인할 수 없습니다.')
          return false
        }
        if (result.stoppedForImportantEvent) {
          reportStoppedAdvance(result, prefix)
          return false
        }
      }

      useGameStore.getState().fastForwardTimeline([], targetTimestamp)
      const stepName = step === 'month' ? '1개월' : step === 'week' ? '1주' : '1일'
      setTimelineMessage(`${prefix}${stepName} 빠른 이동 완료 · 시장 이벤트 ${events.length}건 처리`)
      return true
    } catch (error) {
      setTimelineMessage(error instanceof Error ? `시간 진행 실패: ${error.message}` : '시간 진행에 실패했습니다.')
      return false
    } finally {
      processingTimelineRef.current = false
      setProcessingTimeline(false)
    }
  }

  const performAutoplayTick = async (): Promise<boolean> => performNextEvent(true)
  const resetTimelineUi = () => setTimelineMessage(null)

  const autoplayBlocked = !timelineReady || game.pendingImportantEvents.length > 0 || game.pendingImportantNews.length > 0 || Boolean(game.gameOver) || processingSession || processingTimeline || !nextMarketEvent
  const autoplay = useAutoplay(performAutoplayTick, autoplayBlocked)

  useEffect(() => {
    useAutoplayUiStore.getState().setRunning(autoplay.running)
  }, [autoplay.running])

  useEffect(() => () => {
    useAutoplayUiStore.getState().setRunning(false)
  }, [])

  const loanSubtitle = game.loan.status === 'paid'
    ? '대출 완납'
    : game.loan.status === 'overdue'
      ? `미납 ₩${currency.format(Math.ceil(game.loan.pastDueInterest + game.loan.overdueCharge))} · ${game.loan.consecutiveMissedMonths}개월 연속`
      : loanAnnualRate !== null
        ? `연 ${loanAnnualRate.toFixed(2)}% · 다음 이자 ${nextInterestDate ?? '확인 불가'}`
        : '금리 확인 중'

  const timelineFallback = timelineReady
    ? nextMarketEvent
      ? `다음 이벤트: ${formatMarketEventLabel(nextMarketEvent)} · ${eventTimeLabel(nextMarketEvent)}`
      : '제공된 시장 일정의 마지막 시점입니다.'
    : newsState.status === 'error' || corporateState.status === 'error' || rateState.status === 'unavailable'
      ? '필수 게임 데이터를 확인할 수 없어 시간 진행이 잠시 제한됩니다.'
      : '시장 일정과 게임 데이터를 불러오는 중입니다.'

  const primaryActionLabel = nextMarketEvent ? formatMarketEventLabel(nextMarketEvent) : '진행 종료'
  const primaryActionDisabled = !timelineReady || autoplay.running || processingSession || processingTimeline || !nextMarketEvent

  return {
    game,
    totalAssets,
    netAssets,
    returnRate,
    returnBadgeLabel: returnBadge.label,
    unsettledKrw,
    unsettledUsd,
    loanSubtitle,
    marketStatusLabel,
    marketIndexCards,
    marketIndexStatus: marketIndexState.status,
    marketIndexError: marketIndexState.error,
    nextGameDate: nextMarketEvent ? getKstGameDate(nextMarketEvent.timestamp) : null,
    catalogAssetCount: catalog.assets.filter((asset) => asset.listedFrom <= game.gameDate).length,
    calendarStatus,
    calendarError,
    todayNews,
    todayCorporateEvents,
    corporateStatus: corporateState.status,
    corporateError: corporateState.error,
    newsStatus: newsState.status,
    newsError: newsState.error,
    timelineMessage,
    timelineFallback,
    timelineReady,
    sessionAdvanceBlocked: false,
    processingSession: processingSession || processingTimeline,
    primaryActionLabel,
    primaryActionDisabled,
    resetTimelineUi,
    runPrimaryAction: () => { void performNextEvent() },
    performAdvance,
    autoplay,
  }
}
