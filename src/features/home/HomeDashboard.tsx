import { useMemo, useState } from 'react'
import { advanceGameDate, getNextGameDate, getOpenMarketsOnDate, type GameDateStep } from '../../game/calendar/marketCalendar'
import { getNextLoanPaymentDate } from '../../game/loan/loanEngine'
import { getNewsRevealedOnDate } from '../../game/news/newsEngine'
import { getReturnBadge } from '../../game/portfolio/portfolioEngine'
import { getWsLoanAnnualRate } from '../../game/loan/rateRules'
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
const usdCurrency = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const marketLabels = { KR: 'KRX', US: 'US' } as const
const autoplaySpeeds: AutoplaySpeed[] = [1, 2, 5, 10]
const sessionLabels = { preopen: '개장 전', opened: '장중 · 시가 공개', closed: '장 마감' } as const

interface HomeDashboardProps {
  onOpenMarket: () => void
  onOpenNews: () => void
}

export function HomeDashboard({ onOpenMarket, onOpenNews }: HomeDashboardProps) {
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
    : calendarStatus === 'error' ? '캘린더 오류' : '캘린더 로딩 중'

  const timelineReady = Boolean(calendars && rateState.status === 'ready' && rateState.baseRate !== null && corporateState.status === 'ready' && corporateState.dataset && newsState.status === 'ready')

  const performAdvance = (step: GameDateStep): boolean => {
    if (!calendars || rateState.status !== 'ready' || !corporateState.dataset || newsState.status !== 'ready') return false
    const current = useGameStore.getState()
    const requestedDate = advanceGameDate(current.gameDate, step, calendars)
    if (!requestedDate) {
      setTimelineMessage('현재 캘린더 데이터 범위를 벗어났습니다.')
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
        : '한국은행 기준금리 확인 중'

  const timelineFallback = timelineReady
    ? sessionAdvanceBlocked
      ? game.marketSessionPhase === 'preopen'
        ? '현재 거래일은 개장 전입니다. 주문을 넣은 뒤 장을 시작하거나 주문 없이 장을 시작할 수 있습니다.'
        : '현재 거래일은 장중입니다. 장을 마감하면 당일 OHLC가 공개되고 다음 날짜 진행이 가능합니다.'
      : '결제대금 → 기업행동 → 대출 → 뉴스 공개 순으로 진행하며 중요 이벤트에서는 자동으로 멈춥니다.'
    : newsState.status === 'error'
      ? '뉴스 데이터 오류로 시간을 진행할 수 없습니다.'
      : corporateState.status === 'error'
        ? '기업 이벤트 데이터 오류로 시간을 진행할 수 없습니다.'
        : rateState.status === 'unavailable'
          ? '한국은행 기준금리 데이터가 없어 시간을 진행할 수 없습니다.'
          : '시장 캘린더·기준금리·기업 이벤트·뉴스를 불러오는 중입니다.'

  return (
    <main className="dashboard">
      <section className="hero-panel panel">
        <div className="hero-copy"><p className="section-label">현재 총자산</p><strong className="hero-value">{totalAssets === null ? '평가 대기' : `₩${currency.format(Math.round(totalAssets))}`}</strong><span className={(returnRate ?? 0) >= 0 ? 'positive' : 'negative'}>{returnRate === null ? '실제 가격 데이터 확인 중' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}% · ${returnBadge.label}`}</span></div>
        <div className="hero-status"><span className="status-dot" /><span>{marketStatusLabel}</span><small>{autoplay.running ? `자동진행 ${autoplay.speed}×` : nextGameDate ? `다음 게임일 ${nextGameDate}` : '다음 거래일 확인 불가'}</small></div>
      </section>

      <section className="summary-grid" aria-label="자산 요약">
        <article className="panel metric-card"><p>원화 현금</p><strong>₩{currency.format(game.krwCash)}</strong><span>미결제 매도대금 ₩{currency.format(unsettledKrw)}</span></article>
        <article className="panel metric-card"><p>달러 현금</p><strong>${usdCurrency.format(game.usdCash)}</strong><span>미결제 매도대금 ${usdCurrency.format(unsettledUsd)}</span></article>
        <article className={`panel metric-card warning-card ${game.loan.status === 'overdue' ? 'danger-card' : ''}`}><p>WS은행 대출</p><strong>₩{currency.format(game.loan.principal)}</strong><span>{loanSubtitle}</span></article>
        <article className="panel metric-card"><p>순자산</p><strong>{netAssets === null ? '평가 대기' : `₩${currency.format(Math.round(netAssets))}`}</strong><span>총자산 - 대출·미지급이자</span></article>
      </section>

      <section className="content-grid">
        <article className="panel market-panel"><div className="panel-heading"><div><p className="section-label">MARKET</p><h2>{calendarStatus === 'ready' ? '시장 탐색 준비됨' : '시장 데이터 준비 중'}</h2></div><button type="button" onClick={onOpenMarket}>시장 보기</button></div><div className="placeholder-chart" aria-label="시장 데이터 상태"><span>{calendars ? `캘린더 v${calendars.KR.schemaVersion} · KR ${calendars.KR.tradingDates.length}일 · US ${calendars.US.tradingDates.length}일` : calendarError ?? 'KRX · Alpha Vantage 데이터 스키마 로딩 중'}</span><div className="chart-bars" aria-hidden="true">{[42, 58, 49, 68, 62, 77, 72, 88, 81, 94].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div></article>
        <article className="panel news-panel"><div className="panel-heading"><div><p className="section-label">DAILY NEWS</p><h2>오늘의 뉴스</h2></div><button type="button" onClick={onOpenNews}>뉴스 보기</button></div>{todayNews.length > 0 ? <div className="home-news-list">{todayNews.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={onOpenNews}><span>{item.date} · {item.category}</span><strong>{item.headline}</strong></button>)}</div> : <div className="empty-state"><strong>{newsState.status === 'ready' ? '오늘 공개된 뉴스 없음' : '뉴스 데이터 확인 중'}</strong><p>{newsState.error ?? '뉴스는 역사적으로 공개된 시점이 된 뒤에만 표시됩니다.'}</p></div>}</article>
        <article className="panel news-panel"><div className="panel-heading"><div><p className="section-label">CORPORATE EVENTS</p><h2>오늘의 기업 이벤트</h2></div><span className="count-badge">{todayCorporateEvents.length}</span></div>{todayCorporateEvents.length > 0 ? <div className="event-mini-list">{todayCorporateEvents.map((event) => <div key={event.eventId}><strong>{event.title}</strong><span>{event.note}</span></div>)}</div> : <div className="empty-state"><strong>{corporateState.status === 'ready' ? '오늘 반영된 기업 이벤트 없음' : '기업 이벤트 데이터 확인 중'}</strong><p>{corporateState.error ?? '배당·분할·합병·상폐·거래정지 이벤트는 실제 날짜가 된 뒤에만 반영됩니다.'}</p></div>}</article>
      </section>

      <section className="panel timeline-panel">
        <div><p className="section-label">TIME CONTROL</p><h2>시간 진행</h2><p className="timeline-note" aria-live="polite">{timelineMessage ?? timelineFallback}</p></div>
        <div className="timeline-actions autoplay-layout">
          <button type="button" disabled={!timelineReady || autoplay.running || processingSession || !isTradingDate || game.marketSessionPhase !== 'preopen'} onClick={() => void openCurrentSession()}>장 시작</button>
          <button type="button" disabled={!timelineReady || autoplay.running || processingSession || !isTradingDate || game.marketSessionPhase !== 'opened'} onClick={closeCurrentSession}>장 마감</button>
          <button type="button" disabled={!timelineReady || autoplay.running || sessionAdvanceBlocked} onClick={() => performAdvance('day')}>+1일</button>
          <button type="button" disabled={!timelineReady || autoplay.running || sessionAdvanceBlocked} onClick={() => performAdvance('week')}>+1주</button>
          <button type="button" disabled={!timelineReady || autoplay.running || sessionAdvanceBlocked} onClick={() => performAdvance('month')}>+1개월</button>
          <div className="autoplay-controls"><div className="autoplay-speeds" aria-label="자동진행 속도">{autoplaySpeeds.map((speed) => <button type="button" className={autoplay.speed === speed ? 'active' : ''} key={speed} onClick={() => autoplay.setSpeed(speed)}>{speed}×</button>)}</div><button className={`primary autoplay-toggle ${autoplay.running ? 'running' : ''}`} type="button" disabled={!timelineReady || processingSession} onClick={autoplay.toggle}>{autoplay.running ? '일시정지' : '자동진행'}</button></div></div>
      </section>
    </main>
  )
}
