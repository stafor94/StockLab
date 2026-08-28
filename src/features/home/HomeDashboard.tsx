import { recordLocalQaEvent } from '../guidance/localQaEvents'
import { HomeFeedSections } from './components/HomeFeedSections'
import { InvestmentOverview } from './components/InvestmentOverview'
import { ProgressGuidance } from './components/ProgressGuidance'
import { createProgressGuidance, type ProgressActionTarget } from './progressGuidance'
import { useHomeDashboardController } from './useHomeDashboardController'

interface HomeDashboardProps {
  model: ReturnType<typeof useHomeDashboardController>
  onOpenMarket: () => void
  onOpenNews: () => void
  onOpenAssets: () => void
  onOpenPortfolio: () => void
}

export function HomeDashboard({ model, onOpenMarket, onOpenNews, onOpenAssets, onOpenPortfolio }: HomeDashboardProps) {
  const progressGuidance = createProgressGuidance({
    primaryActionLabel: model.primaryActionLabel,
    timelineMessage: model.timelineMessage ?? model.timelineFallback,
    timelineReady: model.timelineReady,
    pendingImportantNews: model.game.pendingImportantNews.length,
    pendingImportantEvents: model.game.pendingImportantEvents.length,
    loanOverdue: model.game.loan.status === 'overdue',
    gameOver: Boolean(model.game.gameOver),
  })
  const actionDisabled = progressGuidance.actionTarget === 'RUN_PRIMARY' && model.primaryActionDisabled
  const runGuidanceAction = (target: ProgressActionTarget) => {
    recordLocalQaEvent({ name: 'guidance_action', step: target })
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
        marketIndexCards={model.marketIndexCards}
        marketIndexStatus={model.marketIndexStatus}
        marketIndexError={model.marketIndexError}
        nextGameDate={model.nextGameDate}
        catalogAssetCount={model.catalogAssetCount}
        calendarStatus={model.calendarStatus}
        calendarError={model.calendarError}
        holdings={model.topHoldings}
        assets={model.portfolioAssets}
        todayCorporateEvents={model.todayCorporateEvents}
        corporateStatus={model.corporateStatus}
        corporateError={model.corporateError}
        onOpenMarket={onOpenMarket}
        onOpenPortfolio={onOpenPortfolio}
      />

      <section className="home-next-action" aria-labelledby="home-next-action-title">
        <p className="section-kicker" id="home-next-action-title">다음 행동</p>
        <ProgressGuidance
          guidance={progressGuidance}
          actionDisabled={actionDisabled}
          disabledReason={actionDisabled ? '필수 데이터가 준비되거나 현재 진행 작업이 끝나야 실행할 수 있습니다.' : null}
          onAction={() => runGuidanceAction(progressGuidance.actionTarget)}
        />
      </section>
    </main>
  )
}
