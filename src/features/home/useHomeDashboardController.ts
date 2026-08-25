import { useMemo, useState } from 'react'
import { advanceGameDate, getNextGameDate, getOpenMarketsOnDate, type GameDateStep } from '../../game/calendar/marketCalendar'
import { getNextLoanPaymentDate } from '../../game/loan/loanEngine'
import { getWsLoanAnnualRate } from '../../game/loan/rateRules'
import { getNewsRevealedOnDate } from '../../game/news/newsEngine'
import { getReturnBadge } from '../../game/portfolio/portfolioEngine'
import { useBaseRate } from '../../hooks/useBaseRate'
import { useGameStore } from '../../stores/gameStore'
import { useCorporateEvents } from '../events/useCorporateEvents'
import { useMarketCalendars } from '../market/useMarketCalendars'
import { useMarketCatalog } from '../market/useMarketCatalog'
import { useNews } from '../news/useNews'
import { usePortfolioValuation } from '../portfolio/usePortfolioValuation'
import { buildMarketOpenContext } from '../trading/buildMarketOpenContext'
import { useAutoplay, type AutoplaySpeed } from './useAutoplay'

const currency = new Intl.NumberFormat('ko-KR')
const marketLabels = { KR: 'KRX', US: '미국' } as const
const sessionLabels = { preopen: '개장 전', opened: '장중', closed: '장 마감' } as const
export const autoplaySpeeds: AutoplaySpeed[] = [1, 2, 5, 10]

export function useHomeDashboardController() {
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null)
  const [processingSession, setProcessingSession] = useState(false)
  const game = useGameStore()
  const { calendars, status: calendarStatus, error: calendarError } = useMarketCalendars()
  const catalog = useMarketCatalog()
  const rateState = useBaseRate(game.gameDate)
  const corporateState = useCorporateEvents()
  const newsState = useNews()
  const portfolio = usePortfolioValuation()

  const unsettledKrw = game.pendingSettlements.filter((item) => item.currency === 'KRW').reduce((total, item) => total + item.amount, 0)
  const unsettledUsd = game.pendingSettlements.filter((item) => item.currency === 'USD').reduce((total, item) => total + item.amount, 0)
  const totalAssets = portfolio.snapshot.grossAssetsKrw
  const netAssets = portfolio.snapshot.netWorthKrw
  const returnRate = portfolio.snapshot.strategyReturnRate
  const returnBadge = getReturnBadge(returnRate ?? 0)
  const openMarkets = useMemo(() => calendars ? getOpenMarketsOnDate(game.gameDate, calendars) : [], [calendars, game.gameDate])
  const nextGameDate = useMemo(() => calendars ? getNextGameDate(game.gameDate, calendars) : null, [calendars, game.gameDate])
  const gameDates = useMemo(() => calendars ? [...new Set([...calendars.KR.tradingDates, ...calendars.US.tradingDates])].sort() : [], [calendars])
  const nextInterestDate = useMemo(() => calendars ? getNextLoanPaymentDate(game.gameDate, game.loan.originationDate, calendars.KR.tradingDates) : null, [calendars, game.gameDate, game.loan.originationDate])
  const loanAnnualRate = useMemo(() => {
    if (rateState.status !== 'ready') return null
    try { return getWsLoanAnnualRate(rateState.series, game.gameDate) } catch { return null }
  }, [game.gameDate, rateState])
  const todayNews = useMemo(() => calendars ? getNewsRevealedOnDate(newsState.items, game.gameDate, gameDates) : [], [calendars, game.gameDate, gameDates, newsState.items])
  const todayCorporateEvents = game.corporateHistory.filter((item) => item.date === game.gameDate)
  const isTradingDate = gameDates.includes(game.gameDate)
  const sessionAdvanceBlocked = isTradingDate && game.marketSessionPhase !== 'closed'

  const marketStatusLabel = calendarStatus === 'ready'
    ? openMarkets.length > 0
      ? `${openMarkets.map((market) => marketLabels[market]).join(' · ')} · ${sessionLabels[game.marketSessionPhase]}`
      : '양시장 휴장'
    : calendarStatus === 'error' ? '시장 일정 확인 필요' : '시장 일정 확인 중'

  const timelineReady = Boolean(calendars && rateState.status === 'ready' && rateState.baseRate !== null && corporateState.status === 'ready' && corporateState.dataset && newsState.status === 'ready')

  const performAdvance = (step: GameDateStep): boolean => {
    if (!calendars || rateState.status !== 'ready' || !corporateState.dataset || newsState.status !== 'ready') return false
    const current = useGameStore.getState()
    const requestedDate = advanceGameDate(current.gameDate, step, calendars)
    if (!requestedDate) {
      setTimelineMessage('현재 제공되는 게임 날짜 범위를 벗어났습니다.')
      return false
    }
    const cancelledOrders = current.pendingOrders.length
    const result = current.advanceToDate(requestedDate, {
      baseRates: rateState.series,
      bankBusinessDates: calendars.KR.tradingDates,
      corporateEvents: corporateState.dataset.events,
      newsItems: newsState.items,
      gameDates,
    })
    if (!result.ok) {
      setTimelineMessage(result.message)
      return false
    }
    const prefix = cancelledOrders > 0 ? `미체결 주문 ${cancelledOrders}건 취소 · ` : ''
    if (result.stoppedForImportantEvent) {
      const stopText = result.stopReason === 'news' ? '중요 뉴스' : result.stopReason === 'loan' ? 'WS은행 자동출금 실패' : result.stopReason === 'game-over' ? '대출 연체 게임오버' : '중요 기업 이벤트'
      setTimelineMessage(`${prefix}${stopText}로 ${result.gameDate}에서 시간 진행이 멈췄습니다.`)
      return false
    }
    setTimelineMessage(result.message ? `${prefix}${result.message}` : cancelledOrders > 0 ? `${prefix}${result.gameDate}로 이동했습니다.` : null)
    return true
  }

  const openCurrentSession = async (): Promise<boolean> => {
    if (!calendars) return false
    const current = useGameStore.getState()
    if (!gameDates.includes(current.gameDate)) {
      setTimelineMessage('오늘은 양 시장 휴장일이라 장 시작 단계가 없습니다.')
      return true
    }
    if (current.marketSessionPhase !== 'preopen') return true
    setProcessingSession(true)
    try {
      const orders = current.pendingOrders.filter((order) => order.tradeDate === current.gameDate)
      const context = await buildMarketOpenContext({ date: current.gameDate, orders, assets: catalog.assets, calendars })
      const results = current.executeMarketOpen(context)
      const filled = results.filter((result) => result.status === 'filled').length
      const cancelled = results.length - filled
      setTimelineMessage(orders.length === 0
        ? `${current.gameDate} 장을 시작했습니다. 당일 시가가 공개되었습니다.`
        : `${current.gameDate} 시가 체결 ${filled}건${cancelled > 0 ? ` · 취소 ${cancelled}건` : ''}`)
      return true
    } finally {
      setProcessingSession(false)
    }
  }

  const closeCurrentSession = (): boolean => {
    const current = useGameStore.getState()
    if (!gameDates.includes(current.gameDate)) return true
    const result = current.closeMarket()
    setTimelineMessage(result.message)
    return result.ok
  }

  const performAutoplayTick = async (): Promise<boolean> => {
    const current = useGameStore.getState()
    if (gameDates.includes(current.gameDate)) {
      if (current.marketSessionPhase === 'preopen') return openCurrentSession()
      if (current.marketSessionPhase === 'opened') return closeCurrentSession()
    }
    return performAdvance('day')
  }

  const autoplayBlocked = !timelineReady || game.pendingImportantEvents.length > 0 || game.pendingImportantNews.length > 0 || Boolean(game.gameOver) || processingSession
  const autoplay = useAutoplay(performAutoplayTick, autoplayBlocked)

  const loanSubtitle = game.loan.status === 'paid'
    ? '대출 완납'
    : game.loan.status === 'overdue'
      ? `미납 ₩${currency.format(Math.ceil(game.loan.pastDueInterest + game.loan.overdueCharge))} · ${game.loan.consecutiveMissedMonths}개월 연속`
      : loanAnnualRate !== null
        ? `연 ${loanAnnualRate.toFixed(2)}% · 다음 이자 ${nextInterestDate ?? '확인 불가'}`
        : '금리 확인 중'

  const timelineFallback = timelineReady
    ? sessionAdvanceBlocked
      ? game.marketSessionPhase === 'preopen'
        ? '개장 전입니다. 주문을 마친 뒤 장을 시작하세요.'
        : '장중입니다. 장을 마감하면 오늘의 전체 가격이 공개됩니다.'
      : '다음 날짜로 진행할 수 있습니다. 중요 뉴스·기업행동·대출 이벤트에서는 자동으로 멈춥니다.'
    : newsState.status === 'error' || corporateState.status === 'error' || rateState.status === 'unavailable'
      ? '필수 게임 데이터를 확인할 수 없어 시간 진행이 잠시 제한됩니다.'
      : '시장 일정과 게임 데이터를 불러오는 중입니다.'

  const primaryActionLabel = !isTradingDate || game.marketSessionPhase === 'closed'
    ? '다음 날'
    : game.marketSessionPhase === 'preopen' ? '장 시작' : '장 마감'
  const primaryActionDisabled = !timelineReady || autoplay.running || processingSession
  const runPrimaryAction = () => {
    if (!isTradingDate || game.marketSessionPhase === 'closed') {
      performAdvance('day')
      return
    }
    if (game.marketSessionPhase === 'preopen') void openCurrentSession()
    else closeCurrentSession()
  }

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
    nextGameDate,
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
    sessionAdvanceBlocked,
    processingSession,
    primaryActionLabel,
    primaryActionDisabled,
    runPrimaryAction,
    performAdvance,
    autoplay,
  }
}
