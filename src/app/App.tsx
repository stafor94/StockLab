import { useMemo, useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import '../styles/app.css'

const currency = new Intl.NumberFormat('ko-KR')
const usdCurrency = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const navigation = ['홈', '시장', '포트폴리오', '뉴스', '자산'] as const

type NavigationItem = (typeof navigation)[number]

export function App() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationItem>('홈')
  const game = useGameStore()

  const totalAssets = useMemo(() => game.krwCash, [game.krwCash])
  const netAssets = totalAssets - game.loanPrincipal
  const returnRate = ((totalAssets - 10_000_000) / 10_000_000) * 100

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HISTORICAL MARKET GAME</p>
          <div className="brand-row">
            <h1>StockLab</h1>
            <span className="version">v{__APP_VERSION__}</span>
          </div>
        </div>
        <div className="market-date" aria-label="게임 날짜">
          <span>GAME DATE</span>
          <strong>{game.gameDate}</strong>
        </div>
      </header>

      <nav className="desktop-nav" aria-label="주 메뉴">
        {navigation.map((item) => (
          <button
            className={activeNavigation === item ? 'active' : ''}
            key={item}
            onClick={() => setActiveNavigation(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>

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
            <span>개장 전</span>
            <small>첫 거래일 2018-01-02</small>
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
                <h2>시장 준비 중</h2>
              </div>
              <button type="button" disabled>전체 시장</button>
            </div>
            <div className="placeholder-chart" aria-label="차트 데이터 준비 중">
              <span>KRX · Alpha Vantage 데이터 연결 예정</span>
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
          </div>
          <div className="timeline-actions">
            <button type="button" disabled>+1일</button>
            <button type="button" disabled>+1주</button>
            <button type="button" disabled>+1개월</button>
            <button className="primary" type="button" disabled>자동진행</button>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>Save schema v{game.schemaVersion}</span>
        <span>로컬 저장: {game.schemaVersion ? '활성' : '비활성'}</span>
      </footer>

      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {navigation.map((item) => (
          <button
            className={activeNavigation === item ? 'active' : ''}
            key={item}
            onClick={() => setActiveNavigation(item)}
            type="button"
          >
            <span className="nav-mark" aria-hidden="true" />
            {item}
          </button>
        ))}
      </nav>
    </div>
  )
}
