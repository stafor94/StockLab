import { GameProgressSheet } from './components/GameProgressSheet'
import { HomeFeedSections } from './components/HomeFeedSections'
import { InvestmentOverview } from './components/InvestmentOverview'
import { useHomeDashboardController } from './useHomeDashboardController'

interface HomeDashboardProps {
  onOpenMarket: () => void
  onOpenNews: () => void
}

export function HomeDashboard({ onOpenMarket, onOpenNews }: HomeDashboardProps) {
  const model = useHomeDashboardController()
  return (
    <main className="dashboard home-dashboard">
      <div className="home-primary-column">
        <InvestmentOverview
          totalAssets={model.totalAssets}
          netAssets={model.netAssets}
          returnRate={model.returnRate}
          returnBadgeLabel={model.returnBadgeLabel}
          krwCash={model.game.krwCash}
          usdCash={model.game.usdCash}
          unsettledKrw={model.unsettledKrw}
          unsettledUsd={model.unsettledUsd}
          loanPrincipal={model.game.loan.principal}
          loanStatus={model.game.loan.status}
          loanSubtitle={model.loanSubtitle}
        />
        <section className="next-action-card" aria-labelledby="next-action-title">
          <p className="section-kicker">다음 행동</p>
          <h2 id="next-action-title">{model.guidance.currentStage}</h2>
          <p>{model.guidance.recommendation}</p>
          <button
            className="primary-button"
            type="button"
            disabled={model.guidance.disabled}
            onClick={model.guidance.action === 'open-market' ? onOpenMarket : model.guidance.action === 'run-primary' ? model.runPrimaryAction : undefined}
          >
            {model.guidance.primaryLabel}
          </button>
          {model.guidance.state === 'preopen-empty' || model.guidance.state === 'preopen-ordered' ? (
            <button className="next-action-direct" type="button" disabled={model.primaryActionDisabled} onClick={model.runPrimaryAction}>바로 장 시작</button>
          ) : null}
        </section>
      </div>

      <HomeFeedSections
        marketStatusLabel={model.marketStatusLabel}
        nextGameDate={model.nextGameDate}
        catalogAssetCount={model.catalogAssetCount}
        calendarStatus={model.calendarStatus}
        calendarError={model.calendarError}
        todayNews={model.todayNews}
        newsStatus={model.newsStatus}
        newsError={model.newsError}
        todayCorporateEvents={model.todayCorporateEvents}
        corporateStatus={model.corporateStatus}
        corporateError={model.corporateError}
        onOpenMarket={onOpenMarket}
        onOpenNews={onOpenNews}
      />

      <GameProgressSheet
        message={model.timelineMessage ?? model.timelineFallback}
        primaryLabel={model.primaryActionLabel}
        primaryDisabled={model.primaryActionDisabled}
        onPrimary={model.runPrimaryAction}
        timelineReady={model.timelineReady}
        sessionAdvanceBlocked={model.sessionAdvanceBlocked}
        processingSession={model.processingSession}
        running={model.autoplay.running}
        speed={model.autoplay.speed}
        onSpeedChange={model.autoplay.setSpeed}
        onToggleAutoplay={model.autoplay.toggle}
        onAdvanceWeek={() => model.performAdvance('week')}
        onAdvanceMonth={() => model.performAdvance('month')}
      />
    </main>
  )
}
