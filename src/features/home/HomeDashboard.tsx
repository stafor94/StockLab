import type { GuidanceModel } from '../guidance/guidanceSelector'
import { GameProgressSheet } from './components/GameProgressSheet'
import { HomeFeedSections } from './components/HomeFeedSections'
import { InvestmentOverview } from './components/InvestmentOverview'
import { ProgressGuidance } from './components/ProgressGuidance'
import { createProgressGuidance, type ProgressActionTarget } from './progressGuidance'
import { useHomeDashboardController } from './useHomeDashboardController'

interface HomeDashboardProps {
  onOpenMarket: () => void
  onOpenNews: () => void
  onOpenAssets: () => void
  onOpenPortfolio: () => void
  guidance: GuidanceModel
}

export function HomeDashboard({ onOpenMarket, onOpenNews, onOpenAssets, onOpenPortfolio, guidance }: HomeDashboardProps) {
  const model = useHomeDashboardController()
  const progressGuidance = createProgressGuidance({
    sessionPhase: model.game.marketSessionPhase,
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
        <ProgressGuidance
          guidance={progressGuidance}
          actionDisabled={actionDisabled}
          disabledReason={actionDisabled ? '필수 데이터가 준비되거나 현재 진행 작업이 끝나야 실행할 수 있습니다.' : null}
          onAction={() => runGuidanceAction(progressGuidance.actionTarget)}
        />
      </section>

      {!guidance.checklistComplete && (
        <section className="first-game-checklist panel" aria-label="첫 게임 체크리스트">
          <button className="checklist-toggle" type="button" aria-expanded={!guidance.checklistCollapsed} onClick={() => model.game.setChecklistCollapsed(!guidance.checklistCollapsed)}>
            <span><strong>첫 게임 추천</strong><small>{guidance.checklist.length}개 남음</small></span>
            <span aria-hidden="true">{guidance.checklistCollapsed ? '열기' : '접기'}</span>
          </button>
          {!guidance.checklistCollapsed && <ul>{guidance.checklist.map((item) => <li key={item.id}><span aria-hidden="true">○</span>{item.label}</li>)}</ul>}
        </section>
      )}

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
