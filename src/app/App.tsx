import { useState } from 'react'
import { AssetScreen } from '../features/assets/AssetScreen'
import { CorporateEventModal } from '../features/events/CorporateEventModal'
import { HomeDashboard } from '../features/home/HomeDashboard'
import { MarketBrowser } from '../features/market/MarketBrowser'
import { useGameStore } from '../stores/gameStore'
import '../styles/app.css'
import '../styles/market.css'
import '../styles/exchange.css'
import '../styles/loan.css'
import '../styles/events.css'

const navigation = ['홈', '시장', '포트폴리오', '뉴스', '자산'] as const
type NavigationItem = (typeof navigation)[number]

function ComingSoon({ item }: { item: NavigationItem }) {
  return <main className="dashboard"><section className="panel feature-placeholder"><p className="section-label">COMING SOON</p><h2>{item}</h2><p>이 화면은 이후 버전에서 게임 엔진과 함께 연결됩니다.</p></section></main>
}

function GameOverScreen() {
  const game = useGameStore()
  return (
    <main className="game-over-screen">
      <section className="panel game-over-card">
        <p className="section-label">GAME OVER</p>
        <h2>WS은행 대출이자 3개월 연속 미납</h2>
        <p>{game.gameOver?.date} 기준으로 대출 계약을 정상 유지하지 못했습니다. 미결제 매도대금은 현금이 아니므로 이자 납부에 사용할 수 없습니다.</p>
        <dl><div><dt>대출잔액</dt><dd>₩{game.loan.principal.toLocaleString('ko-KR')}</dd></div><div><dt>연속 미납</dt><dd>{game.loan.consecutiveMissedMonths}개월</dd></div></dl>
        <button type="button" onClick={game.resetGame}>새 게임 시작</button>
      </section>
    </main>
  )
}

export function App() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationItem>('홈')
  const gameDate = useGameStore((state) => state.gameDate)
  const schemaVersion = useGameStore((state) => state.schemaVersion)
  const gameOver = useGameStore((state) => state.gameOver)
  const pendingImportantEvent = useGameStore((state) => state.pendingImportantEvents[0] ?? null)
  const acknowledgeCorporateEvent = useGameStore((state) => state.acknowledgeCorporateEvent)

  const normalContent = activeNavigation === '홈'
    ? <HomeDashboard onOpenMarket={() => setActiveNavigation('시장')} />
    : activeNavigation === '시장'
      ? <MarketBrowser />
      : activeNavigation === '자산'
        ? <AssetScreen />
        : <ComingSoon item={activeNavigation} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">HISTORICAL MARKET GAME</p><div className="brand-row"><h1>StockLab</h1><span className="version">v{__APP_VERSION__}</span></div></div>
        <div className="market-date" aria-label="게임 날짜"><span>GAME DATE</span><strong>{gameDate}</strong></div>
      </header>
      {!gameOver && <nav className="desktop-nav" aria-label="주 메뉴">{navigation.map((item) => <button className={activeNavigation === item ? 'active' : ''} key={item} onClick={() => setActiveNavigation(item)} type="button">{item}</button>)}</nav>}
      {gameOver ? <GameOverScreen /> : normalContent}
      <footer className="app-footer"><span>Save schema v{schemaVersion}</span><span>로컬 저장: {schemaVersion ? '활성' : '비활성'}</span></footer>
      {!gameOver && <nav className="mobile-nav" aria-label="모바일 주 메뉴">{navigation.map((item) => <button className={activeNavigation === item ? 'active' : ''} key={item} onClick={() => setActiveNavigation(item)} type="button"><span className="nav-mark" aria-hidden="true" />{item}</button>)}</nav>}
      {!gameOver && pendingImportantEvent && <CorporateEventModal event={pendingImportantEvent} onConfirm={acknowledgeCorporateEvent} />}
    </div>
  )
}
