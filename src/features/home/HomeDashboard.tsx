import { useMemo, useState } from 'react'
import { advanceGameDate, getNextGameDate, getOpenMarketsOnDate, type GameDateStep } from '../../game/calendar/marketCalendar'
import { INITIAL_KRW_CASH } from '../../game/constants'
import { getNextLoanPaymentDate } from '../../game/loan/loanEngine'
import { getWsLoanAnnualRate } from '../../game/loan/rateRules'
import { useBaseRate } from '../../hooks/useBaseRate'
import { useGameStore } from '../../stores/gameStore'
import { useCorporateEvents } from '../events/useCorporateEvents'
import { useMarketCalendars } from '../market/useMarketCalendars'

const currency = new Intl.NumberFormat('ko-KR')
const usdCurrency = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const marketLabels = { KR: 'KRX', US: 'US' } as const

interface HomeDashboardProps {
  onOpenMarket: () => void
}

export function HomeDashboard({ onOpenMarket }: HomeDashboardProps) {
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null)
  const game = useGameStore()
  const { calendars, status: calendarStatus, error: calendarError } = useMarketCalendars()
  const rateState = useBaseRate(game.gameDate)
  const corporateState = useCorporateEvents()

  const krwBookValue = useMemo(
    () => game.positions.filter((item) => item.currency === 'KRW').reduce((total, position) => total + (position.quantity * position.averagePrice), 0),
    [game.positions],
  )
  const unsettledKrw = game.pendingSettlements.filter((item) => item.currency === 'KRW').reduce((total, item) => total + item.amount, 0)
  const unsettledUsd = game.pendingSettlements.filter((item) => item.currency === 'USD').reduce((total, item) => total + item.amount, 0)
  const totalAssets = game.krwCash + krwBookValue + unsettledKrw
  const netAssets = totalAssets - game.loan.principal
  const returnRate = ((totalAssets - INITIAL_KRW_CASH) / INITIAL_KRW_CASH) * 100
  const openMarkets = useMemo(() => calendars ? getOpenMarketsOnDate(game.gameDate, calendars) : [], [calendars, game.gameDate])
  const nextGameDate = useMemo(() => calendars ? getNextGameDate(game.gameDate, calendars) : null, [calendars, game.gameDate])
  const gameDates = useMemo(() => calendars ? [...new Set([...calendars.KR.tradingDates, ...calendars.US.tradingDates])].sort() : [], [calendars])
  const nextInterestDate = useMemo(
    () => calendars ? getNextLoanPaymentDate(game.gameDate, game.loan.originationDate, calendars.KR.tradingDates) : null,
    [calendars, game.gameDate, game.loan.originationDate],
  )
  const loanAnnualRate = useMemo(() => {
    if (rateState.status !== 'ready') return null
    try { return getWsLoanAnnualRate(rateState.series, game.gameDate) } catch { return null }
  }, [game.gameDate, rateState])

  const marketStatusLabel = calendarStatus === 'ready'
    ? openMarkets.length > 0 ? `${openMarkets.map((market) => marketLabels[market]).join(' · ')} 개장일` : '양시장 휴장'
    : calendarStatus === 'error' ? '캘린더 오류' : '캘린더 로딩 중'

  const timelineReady = Boolean(calendars && rateState.status === 'ready' && rateState.baseRate !== null && corporateState.status === 'ready' && corporateState.dataset)
  const advanceDate = (step: GameDateStep) => {
    if (!calendars || rateState.status !== 'ready' || !corporateState.dataset) return
    const requestedDate = advanceGameDate(game.gameDate, step, calendars)
    if (!requestedDate) {
      setTimelineMessage('현재 캘린더 데이터 범위를 벗어났습니다.')
      return
    }
    const cancelledOrders = game.pendingOrders.length
    const result = game.advanceToDate(requestedDate, {
      baseRates: rateState.series,
      bankBusinessDates: calendars.KR.tradingDates,
      corporateEvents: corporateState.dataset.events,
      gameDates,
    })
    if (!result.ok) {
      setTimelineMessage(result.message)
      return
    }
    const prefix = cancelledOrders > 0 ? `미체결 주문 ${cancelledOrders}건 취소 · ` : ''
    if (result.stoppedForImportantEvent) {
      setTimelineMessage(`${prefix}중요 기업 이벤트로 ${result.gameDate}에서 시간 진행이 멈췄습니다.`)
      return
    }
    setTimelineMessage(result.message ? `${prefix}${result.message}` : cancelledOrders > 0 ? `${prefix}${result.gameDate}로 이동했습니다.` : null)
  }

  const loanSubtitle = game.loan.status === 'paid'
    ? '대출 완납'
    : game.loan.status === 'overdue'
      ? `미납 ₩${currency.format(Math.ceil(game.loan.pastDueInterest + game.loan.overdueCharge))} · ${game.loan.consecutiveMissedMonths}개월 연속`
      : loanAnnualRate !== null
        ? `연 ${loanAnnualRate.toFixed(2)}% · 다음 이자 ${nextInterestDate ?? '확인 불가'}`
        : '한국은행 기준금리 확인 중'

  const todayCorporateEvents = game.corporateHistory.filter((item) => item.date === game.gameDate)

  return (
    <main className="dashboard">
      <section className="hero-panel panel">
        <div className="hero-copy"><p className="section-label">현재 총자산</p><strong className="hero-value">₩{currency.format(totalAssets)}</strong><span className={returnRate >= 0 ? 'positive' : 'negative'}>{returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%</span></div>
        <div className="hero-status"><span className="status-dot" /><span>{marketStatusLabel}</span><small>{nextGameDate ? `다음 게임일 ${nextGameDate}` : '다음 거래일 확인 불가'}</small></div>
      </section>

      <section className="summary-grid" aria-label="자산 요약">
        <article className="panel metric-card"><p>원화 현금</p><strong>₩{currency.format(game.krwCash)}</strong><span>미결제 매도대금 ₩{currency.format(unsettledKrw)}</span></article>
        <article className="panel metric-card"><p>달러 현금</p><strong>${usdCurrency.format(game.usdCash)}</strong><span>미결제 매도대금 ${usdCurrency.format(unsettledUsd)}</span></article>
        <article className={`panel metric-card warning-card ${game.loan.status === 'overdue' ? 'danger-card' : ''}`}><p>WS은행 대출</p><strong>₩{currency.format(game.loan.principal)}</strong><span>{loanSubtitle}</span></article>
        <article className="panel metric-card"><p>순자산</p><strong>₩{currency.format(netAssets)}</strong><span>총자산 - 대출잔액</span></article>
      </section>

      <section className="content-grid">
        <article className="panel market-panel"><div className="panel-heading"><div><p className="section-label">MARKET</p><h2>{calendarStatus === 'ready' ? '시장 탐색 준비됨' : '시장 데이터 준비 중'}</h2></div><button type="button" onClick={onOpenMarket}>시장 보기</button></div><div className="placeholder-chart" aria-label="시장 데이터 상태"><span>{calendars ? `캘린더 v${calendars.KR.schemaVersion} · KR ${calendars.KR.tradingDates.length}일 · US ${calendars.US.tradingDates.length}일` : calendarError ?? 'KRX · Alpha Vantage 데이터 스키마 로딩 중'}</span><div className="chart-bars" aria-hidden="true">{[42, 58, 49, 68, 62, 77, 72, 88, 81, 94].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div></article>
        <article className="panel news-panel"><div className="panel-heading"><div><p className="section-label">CORPORATE EVENTS</p><h2>오늘의 기업 이벤트</h2></div><span className="count-badge">{todayCorporateEvents.length}</span></div>{todayCorporateEvents.length > 0 ? <div className="event-mini-list">{todayCorporateEvents.map((event) => <div key={event.eventId}><strong>{event.title}</strong><span>{event.note}</span></div>)}</div> : <div className="empty-state"><strong>{corporateState.status === 'ready' ? '오늘 반영된 기업 이벤트 없음' : '기업 이벤트 데이터 확인 중'}</strong><p>{corporateState.error ?? '배당·분할·합병·상폐·거래정지 이벤트는 실제 날짜가 된 뒤에만 반영됩니다.'}</p></div>}</article>
      </section>

      <section className="panel timeline-panel">
        <div><p className="section-label">TIME CONTROL</p><h2>시간 진행</h2><p className="timeline-note" aria-live="polite">{timelineMessage ?? (timelineReady ? '날짜 진행 시 결제대금 → 기업행동 → 대출 이자/재출금 순서로 자동 처리됩니다.' : corporateState.status === 'error' ? '기업 이벤트 데이터 오류로 시간을 진행할 수 없습니다.' : rateState.status === 'unavailable' ? '한국은행 기준금리 데이터가 없어 시간을 진행할 수 없습니다.' : '시장 캘린더·기준금리·기업 이벤트를 불러오는 중입니다.')}</p></div>
        <div className="timeline-actions"><button type="button" disabled={!timelineReady} onClick={() => advanceDate('day')}>+1일</button><button type="button" disabled={!timelineReady} onClick={() => advanceDate('week')}>+1주</button><button type="button" disabled={!timelineReady} onClick={() => advanceDate('month')}>+1개월</button><button className="primary" type="button" disabled>자동진행</button></div>
      </section>
    </main>
  )
}
