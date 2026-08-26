import { useState } from 'react'
import { AssetScreen } from '../features/assets/AssetScreen'
import { CorporateEventModal } from '../features/events/CorporateEventModal'
import { HomeDashboard } from '../features/home/HomeDashboard'
import { MarketBrowser } from '../features/market/MarketBrowser'
import { ImportantNewsModal } from '../features/news/ImportantNewsModal'
import { NewsScreen } from '../features/news/NewsScreen'
import { PortfolioScreen } from '../features/portfolio/PortfolioScreen'
import { useGameStore } from '../stores/gameStore'
import { AppHeader, AppNavigation, type NavigationItem } from './AppNavigation'
import '../styles/app.css'
import '../styles/home.css'
import '../styles/market.css'
import '../styles/exchange.css'
import '../styles/loan.css'
import '../styles/events.css'
import '../styles/news.css'
import '../styles/autoplay.css'
import '../styles/portfolio.css'

function GameOverScreen() {
  const game = useGameStore()
  return (
    <main className="game-over-screen">
      <section className="game-over-card" role="alert">
        <p className="section-kicker danger-text">게임 종료</p>
        <h2>WS은행 대출이자 3개월 연속 미납</h2>
        <p>{game.gameOver?.date} 기준으로 대출 계약을 정상 유지하지 못했습니다. 미결제 매도대금은 현금이 아니므로 이자 납부에 사용할 수 없습니다.</p>
        <dl><div><dt>대출잔액</dt><dd>₩{game.loan.principal.toLocaleString('ko-KR')}</dd></div><div><dt>연속 미납</dt><dd>{game.loan.consecutiveMissedMonths}개월</dd></div></dl>
        <button className="primary-button" type="button" onClick={game.resetGame}>새 게임 시작</button>
      </section>
    </main>
  )
}

export function App() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationItem>('홈')
  const gameDate = useGameStore((state) => state.gameDate)
  const gameOver = useGameStore((state) => state.gameOver)
  const pendingImportantEvent = useGameStore((state) => state.pendingImportantEvents[0] ?? null)
  const pendingImportantNews = useGameStore((state) => state.pendingImportantNews[0] ?? null)
  const acknowledgeCorporateEvent = useGameStore((state) => state.acknowledgeCorporateEvent)
  const acknowledgeImportantNews = useGameStore((state) => state.acknowledgeImportantNews)

  const normalContent = activeNavigation === '홈'
    ? <HomeDashboard onOpenMarket={() => setActiveNavigation('시장')} onOpenNews={() => setActiveNavigation('뉴스')} onOpenAssets={() => setActiveNavigation('자산')} onOpenPortfolio={() => setActiveNavigation('포트폴리오')} />
    : activeNavigation === '시장' ? <MarketBrowser />
      : activeNavigation === '포트폴리오' ? <PortfolioScreen />
        : activeNavigation === '뉴스' ? <NewsScreen />
          : <AssetScreen />

  const openImportantNews = () => { acknowledgeImportantNews(); setActiveNavigation('뉴스') }

  return (
    <div className="app-shell">
      <AppHeader gameDate={gameDate} />
      {!gameOver && <AppNavigation active={activeNavigation} onChange={setActiveNavigation} />}
      <div className="app-screen">{gameOver ? <GameOverScreen /> : normalContent}</div>
      {!gameOver && pendingImportantEvent && <CorporateEventModal event={pendingImportantEvent} onConfirm={acknowledgeCorporateEvent} />}
      {!gameOver && !pendingImportantEvent && pendingImportantNews && <ImportantNewsModal news={pendingImportantNews} onConfirm={acknowledgeImportantNews} onOpenNews={openImportantNews} />}
    </div>
  )
}
