import { HomeFeedSections } from './components/HomeFeedSections'
import { InvestmentOverview } from './components/InvestmentOverview'
import { TimeControl } from './components/TimeControl'
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

      <TimeControl
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
