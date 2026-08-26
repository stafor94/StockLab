import { GameProgressSheet } from './components/GameProgressSheet'
import { HomeFeedSections } from './components/HomeFeedSections'
import { InvestmentOverview } from './components/InvestmentOverview'
import { useHomeDashboardController } from './useHomeDashboardController'
import type { GuidanceModel } from '../guidance/guidanceSelector'

interface HomeDashboardProps {
  onOpenMarket: () => void
  onOpenNews: () => void
  guidance: GuidanceModel
}

export function HomeDashboard({ onOpenMarket, onOpenNews, guidance }: HomeDashboardProps) {
  const model = useHomeDashboardController(guidance)
  const setCollapsed = model.game.setChecklistCollapsed
  return (
    <main className="dashboard home-dashboard">
      <div className="home-primary-column">
        {!guidance.checklistComplete && <section className="first-game-checklist panel" aria-label="첫 게임 체크리스트">
          <button className="checklist-toggle" type="button" aria-expanded={!guidance.checklistCollapsed} onClick={() => setCollapsed(!guidance.checklistCollapsed)}>
            <span><strong>첫 게임 추천</strong><small>{guidance.checklist.length}개 남음</small></span><span aria-hidden="true">{guidance.checklistCollapsed ? '열기' : '접기'}</span>
          </button>
          {!guidance.checklistCollapsed && <ul>{guidance.checklist.map((item) => <li key={item.id}><span aria-hidden="true">○</span>{item.label}</li>)}</ul>}
        </section>}
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
