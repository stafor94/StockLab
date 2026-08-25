import { useMemo, useState } from 'react'
import { useMarketCalendars } from '../market/useMarketCalendars'
import {
  advanceGameDate,
  getNextGameDate,
  getOpenMarketsOnDate,
  type GameDateStep,
} from '../../game/calendar/marketCalendar'
import { INITIAL_KRW_CASH } from '../../game/constants'
import { useGameStore } from '../../stores/gameStore'

const currency = new Intl.NumberFormat('ko-KR')
const usdCurrency = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const marketLabels = { KR: 'KRX', US: 'US' } as const

interface HomeDashboardProps {
  onOpenMarket: () => void
}

export function HomeDashboard({ onOpenMarket }: HomeDashboardProps) {
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null)
  const game = useGameStore()
  const { calendars, status: calendarStatus, error: calendarError } = useMarketCalendars()

  const totalAssets = useMemo(() => game.krwCash, [game.krwCash])
  const netAssets = totalAssets - game.loanPrincipal
  const returnRate = ((totalAssets - INITIAL_KRW_CASH) / INITIAL_KRW_CASH) * 100
  const openMarkets = useMemo(
    () => (calendars ? getOpenMarketsOnDate(game.gameDate, calendars) : []),
    [calendars, game.gameDate],
  )
  const nextGameDate = useMemo(
    () => (calendars ? getNextGameDate(game.gameDate, calendars) : null),
    [calendars, game.gameDate],
  )

  const marketStatusLabel = calendarStatus === 'ready'
    ? openMarkets.length > 0
      ? `${openMarkets.map((market) => marketLabels[market]).join(' · ')} 개장일`
      : '양시장 휴장'
    : calendarStatus === 'error'
      ? '캘린더 오류'
      : '캘린더 로딩 중'

  const advanceDate = (step: GameDateStep) => {
    if (!calendars) return
    const nextDate = advanceGameDate(game.gameDate, step, calendars)
    if (!nextDate) {
      setTimelineMessage('현재 캘린더 데이터 범위를 벗어났습니다.')
      return
    }
    game.setGameDate(nextDate)
    setTimelineMessage(null)
  }

  return (
    <main className="dashboard">
      <section className="hero-panel panel">
        <div className="hero-copy">
          <p className="section-label">현재 총자산</p>
          <strong className="hero-value">₩{currency.format(totalAssets)}</strong>
          <span className={returnRate >= 0 ? 'positive' : 'negative'}>
            {returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%
          </span>
        </div>
        <div className="hero-status">
          <span className="status-dot" />
          <span>{marketStatusLabel}</span>
          <small>{nextGameDate ? `다음 게임일 ${nextGameDate}` : '다음 거래일 확인 불가'}</small>
        </div>
      </section>

      <section className="summary-grid" aria-label="자산 요약">
        <article className="panel metric-card">
          <p>원화 현금</p>
          <strong>₩{currency.format(game.krwCash)}</strong>
          <span>WS증권 출금가능 기준</span>
        </article>
        <article className="panel metric-card">
          <p>달러 현금</p>
          <strong>${usdCurrency.format(game.usdCash)}</strong>
          <span>환전우대 95% 예정</span>
        </article>
        <article className="panel metric-card warning-card">
          <p>WS은행 대출</p>
          <strong>₩{currency.format(game.loanPrincipal)}</strong>
          <span>월 이자 납부 시스템 구현 예정</span>
        </article>
        <article className="panel metric-card">
          <p>순자산</p>
          <strong>₩{currency.format(netAssets)}</strong>
          <span>총자산 - 대출잔액</span>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel market-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">MARKET</p>
              <h2>{calendarStatus === 'ready' ? '시장 탐색 준비됨' : '시장 데이터 준비 중'}</h2>
            </div>
            <button type="button" onClick={onOpenMarket}>시장 보기</button>
          </div>
          <div className="placeholder-chart" aria-label="시장 데이터 상태">
            <span>
              {calendars
                ? `캘린더 v${calendars.KR.schemaVersion} · KR ${calendars.KR.tradingDates.length}일 · US ${calendars.US.tradingDates.length}일`
                : calendarError ?? 'KRX · Alpha Vantage 데이터 스키마 로딩 중'}
            </span>
            <div className="chart-bars" aria-hidden="true">
              {[42, 58, 49, 68, 62, 77, 72, 88, 81, 94].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </article>

        <article className="panel news-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">DAILY NEWS</p>
              <h2>오늘의 뉴스</h2>
            </div>
            <span className="count-badge">0</span>
          </div>
          <div className="empty-state">
            <strong>2018년 시장 데이터 준비 중</strong>
            <p>뉴스는 해당 게임 날짜가 된 뒤에만 공개됩니다.</p>
          </div>
        </article>
      </section>

      <section className="panel timeline-panel">
        <div>
          <p className="section-label">TIME CONTROL</p>
          <h2>시간 진행</h2>
          <p className="timeline-note" aria-live="polite">
            {timelineMessage ?? (calendarStatus === 'ready' ? '양 시장이 모두 쉬는 날은 자동으로 건너뜁니다.' : '시장 캘린더를 불러오는 중입니다.')}
          </p>
        </div>
        <div className="timeline-actions">
          <button type="button" disabled={!calendars} onClick={() => advanceDate('day')}>+1일</button>
          <button type="button" disabled={!calendars} onClick={() => advanceDate('week')}>+1주</button>
          <button type="button" disabled={!calendars} onClick={() => advanceDate('month')}>+1개월</button>
          <button className="primary" type="button" disabled>자동진행</button>
        </div>
      </section>
    </main>
  )
}
