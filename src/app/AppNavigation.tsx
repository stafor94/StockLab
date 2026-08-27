import { useEffect, useMemo, useState } from 'react'
import { AppIcon, type AppIconName } from '../components/AppIcon'
import { formatKstGameDate, getKstGameDate, getKstGameTime } from '../game/calendar/marketTimeline'
import { useHelp } from '../features/help/HelpCenter'
import type { NavigationGuidance } from '../features/guidance/guidanceSelector'
import { useMarketCalendars } from '../features/market/useMarketCalendars'

export const navigationItems = [
  { label: '홈', icon: 'home' },
  { label: '시장', icon: 'market' },
  { label: '포트폴리오', icon: 'portfolio' },
  { label: '뉴스', icon: 'news' },
  { label: '자산', icon: 'assets' },
] as const satisfies ReadonlyArray<{ label: string; icon: AppIconName }>

export type NavigationItem = (typeof navigationItems)[number]['label']

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

function buildMonthDates(month: string): Array<string | null> {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const lastDate = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const dates: Array<string | null> = Array.from({ length: firstDay }, () => null)
  for (let day = 1; day <= lastDate; day += 1) dates.push(`${month}-${String(day).padStart(2, '0')}`)
  while (dates.length % 7 !== 0) dates.push(null)
  return dates
}

function MarketCalendarDialog({ gameDate, onClose }: { gameDate: string; onClose: () => void }) {
  const { calendars, status, error } = useMarketCalendars()
  const [viewMonth, setViewMonth] = useState(gameDate.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(gameDate)
  const dates = useMemo(() => buildMonthDates(viewMonth), [viewMonth])
  const closures = useMemo(() => ({
    KR: new Map(calendars?.KR.closures.map((item) => [item.date, item.reason]) ?? []),
    US: new Map(calendars?.US.closures.map((item) => [item.date, item.reason]) ?? []),
  }), [calendars])
  const [year, month] = viewMonth.split('-').map(Number)
  const krReason = closures.KR.get(selectedDate)
  const usReason = closures.US.get(selectedDate)
  const selectedDay = new Date(`${selectedDate}T00:00:00Z`).getUTCDay()
  const selectedWeekend = selectedDay === 0 || selectedDay === 6

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="market-calendar-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="market-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="market-calendar-title">
        <header className="market-calendar-header">
          <div><span>시장 캘린더</span><h2 id="market-calendar-title">{year}년 {month}월</h2></div>
          <button type="button" className="market-calendar-close" aria-label="시장 캘린더 닫기" onClick={onClose}>×</button>
        </header>
        <div className="market-calendar-month-controls">
          <button type="button" aria-label="이전 달" onClick={() => setViewMonth((value) => shiftMonth(value, -1))}>‹</button>
          <button type="button" onClick={() => { setViewMonth(gameDate.slice(0, 7)); setSelectedDate(gameDate) }}>현재 날짜</button>
          <button type="button" aria-label="다음 달" onClick={() => setViewMonth((value) => shiftMonth(value, 1))}>›</button>
        </div>
        {status === 'error' ? <p className="market-calendar-message danger-text">{error ?? '시장 캘린더를 불러올 수 없습니다.'}</p> : (
          <>
            <div className="market-calendar-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="market-calendar-grid" aria-label={`${year}년 ${month}월 시장 휴장일`}>
              {dates.map((date, index) => {
                if (!date) return <span className="market-calendar-empty" key={`empty-${index}`} />
                const day = Number(date.slice(-2))
                const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay()
                const weekend = dayOfWeek === 0 || dayOfWeek === 6
                const krClosed = closures.KR.has(date)
                const usClosed = closures.US.has(date)
                const labels = [weekend ? '주말' : '', krClosed ? 'KRX 휴장' : '', usClosed ? '미국 휴장' : ''].filter(Boolean).join(', ')
                return (
                  <button
                    type="button"
                    key={date}
                    className={['market-calendar-day', date === gameDate ? 'current' : '', date === selectedDate ? 'selected' : '', weekend || krClosed || usClosed ? 'closed' : ''].filter(Boolean).join(' ')}
                    aria-label={`${date}${labels ? `, ${labels}` : ''}${date === gameDate ? ', 현재 날짜' : ''}`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <strong>{day}</strong>
                    <span className="market-calendar-marks" aria-hidden="true">
                      {krClosed && <i className="kr">한</i>}
                      {usClosed && <i className="us">미</i>}
                      {weekend && !krClosed && !usClosed && <i className="weekend">주</i>}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="market-calendar-legend"><span><i className="kr">한</i> KRX 휴장</span><span><i className="us">미</i> 미국 휴장</span><span><i className="weekend">주</i> 주말</span></div>
            <div className="market-calendar-detail" aria-live="polite">
              <strong>{selectedDate}{selectedDate === gameDate ? ' · 현재 날짜' : ''}</strong>
              {status === 'loading' ? <span>휴장일 확인 중</span> : krReason || usReason || selectedWeekend ? (
                <div>{krReason && <span>KRX · {krReason}</span>}{usReason && <span>미국 · {usReason}</span>}{selectedWeekend && !krReason && !usReason && <span>주말 · 정규장 없음</span>}</div>
              ) : <span>KRX · 미국 정규 거래일</span>}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export function AppHeader({ gameTimestamp, onOpenSettings }: { gameTimestamp: string; onOpenSettings: () => void }) {
  const { openHelp } = useHelp()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const gameDate = getKstGameDate(gameTimestamp)
  return (
    <header className="app-header">
      <div className="app-header-brand"><h1>StockLab</h1><span>v{__APP_VERSION__}</span></div>
      <div className="app-header-actions">
        <button className="app-game-date" type="button" aria-label={`현재 날짜 ${formatKstGameDate(gameTimestamp)} ${getKstGameTime(gameTimestamp)}, 시장 캘린더 열기`} aria-haspopup="dialog" onClick={() => setCalendarOpen(true)}>
          <span>현재 날짜</span>
          <div><strong>{formatKstGameDate(gameTimestamp)}</strong><time dateTime={gameTimestamp}>{getKstGameTime(gameTimestamp)}</time></div>
        </button>
        <div className="app-header-utility-actions">
          <button className="header-help-button" type="button" onClick={() => openHelp()}>도움말</button>
          <button className="header-settings-button" type="button" aria-label="설정" onClick={onOpenSettings}><AppIcon name="settings" size={20} /></button>
        </div>
      </div>
      {calendarOpen && <MarketCalendarDialog gameDate={gameDate} onClose={() => setCalendarOpen(false)} />}
    </header>
  )
}

interface AppNavigationProps {
  active: NavigationItem
  onChange: (item: NavigationItem) => void
  guidance?: Partial<Record<NavigationItem, NavigationGuidance>>
}

function clearFocusedNavigationItem() {
  const focused = document.activeElement
  if (focused instanceof HTMLElement && focused.closest('.app-navigation')) focused.blur()
}

export function AppNavigation({ active, onChange, guidance = {} }: AppNavigationProps) {
  const [keyboardModality, setKeyboardModality] = useState(false)

  useEffect(() => {
    const handleKeyboardInput = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      setKeyboardModality(true)
    }
    const handlePointerInput = () => setKeyboardModality(false)
    window.addEventListener('keydown', handleKeyboardInput, true)
    window.addEventListener('pointerdown', handlePointerInput, true)
    return () => {
      window.removeEventListener('keydown', handleKeyboardInput, true)
      window.removeEventListener('pointerdown', handlePointerInput, true)
    }
  }, [])

  return (
    <nav className="app-navigation" aria-label="주 메뉴" data-keyboard-focus={keyboardModality ? 'true' : 'false'}>
      {navigationItems.map((item) => {
        const badge = guidance[item.label] ?? {}
        const label = badge.attentionReason ? `${item.label}, ${badge.attentionReason}` : item.label
        return (
          <button
            type="button"
            key={item.label}
            className={[active === item.label ? 'active' : '', badge.isRecommended ? 'guidance-recommended' : ''].filter(Boolean).join(' ')}
            aria-label={label}
            aria-current={active === item.label ? 'page' : undefined}
            data-tutorial-id={item.label === '시장' ? 'navigation-market' : undefined}
            onPointerDown={() => {
              setKeyboardModality(false)
              clearFocusedNavigationItem()
            }}
            onClick={(event) => {
              onChange(item.label)
              if (event.detail > 0) {
                setKeyboardModality(false)
                event.currentTarget.blur()
              } else {
                setKeyboardModality(true)
              }
            }}
          >
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
            {badge.attentionCount ? <span className="navigation-attention" aria-hidden="true">{badge.attentionCount > 9 ? '9+' : badge.attentionCount}</span> : null}
            {badge.isExperienced ? <span className="navigation-check" aria-hidden="true">✓</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
