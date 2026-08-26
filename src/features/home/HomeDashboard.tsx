import { GameProgressSheet } from './components/GameProgressSheet'
import { HomeFeedSections } from './components/HomeFeedSections'
import { InvestmentOverview } from './components/InvestmentOverview'
import { useHomeDashboardController } from './useHomeDashboardController'
import { ProgressGuidance } from './components/ProgressGuidance'
import type { ProgressActionTarget } from './progressGuidance'

interface HomeDashboardProps {
  onOpenMarket: () => void
  onOpenNews: () => void
  onOpenAssets: () => void
  onOpenPortfolio: () => void
}

export function HomeDashboard({ onOpenMarket, onOpenNews, onOpenAssets, onOpenPortfolio }: HomeDashboardProps) {
  const model = useHomeDashboardController()
  const guidance = model.timelineGuidance ?? model.timelineFallback
  const progressionTargets: ProgressActionTarget[] = ['OPEN_SESSION', 'CLOSE_SESSION', 'ADVANCE_DATE']
  const guidanceActionDisabled = progressionTargets.includes(guidance.actionTarget) && model.primaryActionDisabled
  const runGuidanceAction = (target: ProgressActionTarget) => {
    if (target === 'REVIEW_NEWS') return onOpenNews()
    if (target === 'REVIEW_EVENT') return model.game.acknowledgeCorporateEvent()
    if (target === 'REVIEW_CASH_LOAN') return onOpenAssets()
    if (target === 'REVIEW_PERFORMANCE') return onOpenPortfolio()
    if (target === 'RETRY_DATA') return window.location.reload()
    model.runPrimaryAction()
  }
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

      <section className="home-next-action" aria-labelledby="home-next-action-title">
        <p className="section-kicker" id="home-next-action-title">다음 행동</p>
        <ProgressGuidance guidance={guidance} actionDisabled={guidanceActionDisabled} disabledReason={guidanceActionDisabled ? '필수 데이터가 준비되거나 현재 진행 작업이 끝나야 실행할 수 있습니다.' : null} onAction={() => runGuidanceAction(guidance.actionTarget)} />
      </section>

      <GameProgressSheet
        guidance={guidance}
        primaryLabel={guidance.actionLabel}
        primaryDisabled={guidanceActionDisabled}
        onPrimary={() => runGuidanceAction(guidance.actionTarget)}
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
