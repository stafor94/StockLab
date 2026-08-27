import { useState } from 'react'
import { AssetScreen } from '../features/assets/AssetScreen'
import { CorporateEventModal } from '../features/events/CorporateEventModal'
import { selectGuidance } from '../features/guidance/guidanceSelector'
import { recordLocalQaEvent } from '../features/guidance/localQaEvents'
import { HelpProvider } from '../features/help/HelpCenter'
import { HomeDashboard } from '../features/home/HomeDashboard'
import { MarketBrowser } from '../features/market/MarketBrowser'
import { ImportantNewsModal } from '../features/news/ImportantNewsModal'
import { NewsScreen } from '../features/news/NewsScreen'
import { PortfolioScreen } from '../features/portfolio/PortfolioScreen'
import { SettingsDialog } from '../features/settings/SettingsDialog'
import { FirstRunTutorial } from '../features/tutorial/FirstRunTutorial'
import { useGameStore } from '../stores/gameStore'
import { formatMoney } from '../utils/money'
import { AppHeader, AppNavigation, type NavigationItem } from './AppNavigation'
import '../styles/app.css'
import '../styles/calendar.css'
import '../styles/home.css'
import '../styles/market.css'
import '../styles/exchange.css'
import '../styles/loan.css'
import '../styles/events.css'
import '../styles/news.css'
import '../styles/autoplay.css'
import '../styles/portfolio.css'
import '../styles/help.css'
import '../styles/settings.css'
import '../styles/tutorial.css'
import '../styles/guidance.css'

function GameOverScreen({ onResetGame }: { onResetGame: () => void }) {
  const game = useGameStore()
  return (
    <main className="game-over-screen">
      <section className="game-over-card" role="alert">
        <p className="section-kicker danger-text">게임 종료</p>
        <h2>WS은행 대출이자 3개월 연속 미납</h2>
        <p>{game.gameOver?.date} 기준으로 대출 계약을 정상 유지하지 못했습니다. 미결제 매도대금은 현금이 아니므로 이자 납부에 사용할 수 없습니다.</p>
        <dl><div><dt>대출잔액</dt><dd>{formatMoney(game.loan.principal, 'KRW')}</dd></div><div><dt>연속 미납</dt><dd>{game.loan.consecutiveMissedMonths}개월</dd></div></dl>
        <button className="primary-button" type="button" onClick={onResetGame}>새 게임 시작</button>
      </section>
    </main>
  )
}

function AppContent() {
  const [activeNavigation, setActiveNavigation] = useState<NavigationItem>('홈')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gameResetRevision, setGameResetRevision] = useState(0)
  const gameDisplayTimestamp = useGameStore((state) => state.gameDisplayTimestamp)
  const gameOver = useGameStore((state) => state.gameOver)
  const resetGame = useGameStore((state) => state.resetGame)
  const pendingImportantEvent = useGameStore((state) => state.pendingImportantEvents[0] ?? null)
  const pendingImportantNews = useGameStore((state) => state.pendingImportantNews[0] ?? null)
  const acknowledgeCorporateEvent = useGameStore((state) => state.acknowledgeCorporateEvent)
  const acknowledgeImportantNews = useGameStore((state) => state.acknowledgeImportantNews)
  const acknowledgeLoanPaymentFailures = useGameStore((state) => state.acknowledgeLoanPaymentFailures)
  const guidanceState = useGameStore((state) => state)
  const guidance = selectGuidance(guidanceState)
  const tutorialStatus = useGameStore((state) => state.guidance.tutorialStatus)
  const setTutorialStatus = useGameStore((state) => state.setTutorialStatus)
  const markGuidanceExperience = useGameStore((state) => state.markGuidanceExperience)
  const tutorialOpen = tutorialStatus === 'not-started' && !gameOver

  const changeNavigation = (item: NavigationItem) => {
    setActiveNavigation(item)
    if (item === '시장') markGuidanceExperience('market-visited')
    if (item === '자산') acknowledgeLoanPaymentFailures()
  }

  const resetCurrentGame = () => {
    resetGame()
    setActiveNavigation('홈')
    setSettingsOpen(false)
    setGameResetRevision((revision) => revision + 1)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  const normalContent = activeNavigation === '홈'
    ? <HomeDashboard onOpenMarket={() => changeNavigation('시장')} onOpenNews={() => changeNavigation('뉴스')} onOpenAssets={() => changeNavigation('자산')} onOpenPortfolio={() => changeNavigation('포트폴리오')} />
    : activeNavigation === '시장' ? <MarketBrowser />
      : activeNavigation === '포트폴리오' ? <PortfolioScreen />
        : activeNavigation === '뉴스' ? <NewsScreen />
          : <AssetScreen />

  const openImportantNews = () => { acknowledgeImportantNews(); changeNavigation('뉴스') }
  const completeTutorial = () => { setTutorialStatus('completed'); recordLocalQaEvent({ name: 'tutorial_completed' }) }
  const skipTutorial = () => { setTutorialStatus('skipped'); recordLocalQaEvent({ name: 'tutorial_skipped' }) }

  return (
    <div className="app-shell">
      <AppHeader gameTimestamp={gameDisplayTimestamp} onOpenSettings={() => setSettingsOpen(true)} />
      {!gameOver && <AppNavigation active={activeNavigation} onChange={changeNavigation} guidance={guidance.navigation} />}
      <div key={gameResetRevision} className="app-screen">{gameOver ? <GameOverScreen onResetGame={resetCurrentGame} /> : normalContent}</div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onResetGame={resetCurrentGame} />
      {!gameOver && pendingImportantEvent && <CorporateEventModal event={pendingImportantEvent} onConfirm={acknowledgeCorporateEvent} />}
      {!gameOver && !pendingImportantEvent && pendingImportantNews && <ImportantNewsModal news={pendingImportantNews} onConfirm={acknowledgeImportantNews} onOpenNews={openImportantNews} />}
      <FirstRunTutorial open={tutorialOpen} onComplete={completeTutorial} onSkip={skipTutorial} />
    </div>
  )
}

export function App() {
  return <HelpProvider><AppContent /></HelpProvider>
}
