import { useState } from 'react'
import { ExchangeScreen } from '../features/assets/ExchangeScreen'
import { HomeDashboard } from '../features/home/HomeDashboard'
import { MarketBrowser } from '../features/market/MarketBrowser'
import { useGameStore } from '../stores/gameStore'
import '../styles/app.css'
import '../styles/market.css'
import '../styles/exchange.css'

const navigation = ['홈', '시장', '포트폴리오', '뉴스', '자산'] as const
type NavigationItem = (typeof navigation)[number]

function ComingSoon({ item }: { item: NavigationItem }) {
  return <main className="dashboard"><section className="panel feature-placeholder"><p className="section-label">COMING SOON</p><h2>{item}</h2><p>이 화면은 이후 버전에서 게임 엔진과 함께 연결됩니다.</p></section></main>
}

export function App() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationItem>('홈')
  const gameDate = useGameStore((state) => state.gameDate)
  const schemaVersion = useGameStore((state) => state.schemaVersion)

  const content = activeNavigation === '홈'
    ? <HomeDashboard onOpenMarket={() => setActiveNavigation('시장')} />
    : activeNavigation === '시장'
      ? <MarketBrowser />
      : activeNavigation === '자산'
        ? <ExchangeScreen />
        : <ComingSoon item={activeNavigation} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">HISTORICAL MARKET GAME</p><div className="brand-row"><h1>StockLab</h1><span className="version">v{__APP_VERSION__}</span></div></div>
        <div className="market-date" aria-label="게임 날짜"><span>GAME DATE</span><strong>{gameDate}</strong></div>
      </header>
      <nav className="desktop-nav" aria-label="주 메뉴">
        {navigation.map((item) => <button className={activeNavigation === item ? 'active' : ''} key={item} onClick={() => setActiveNavigation(item)} type="button">{item}</button>)}
      </nav>
      {content}
      <footer className="app-footer"><span>Save schema v{schemaVersion}</span><span>로컬 저장: {schemaVersion ? '활성' : '비활성'}</span></footer>
      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {navigation.map((item) => <button className={activeNavigation === item ? 'active' : ''} key={item} onClick={() => setActiveNavigation(item)} type="button"><span className="nav-mark" aria-hidden="true" />{item}</button>)}
      </nav>
    </div>
  )
}
