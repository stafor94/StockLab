import type { NavigationItem } from '../../app/AppNavigation'
import type { GameSave, FirstGameExperience } from '../../game/save'

export type GuidanceAction = 'open-market' | 'open-session' | 'close-session' | 'next-day'

export interface NavigationGuidance {
  attentionCount?: number
  attentionReason?: string
  isRecommended?: boolean
  isExperienced?: boolean
}

export interface ChecklistItem {
  id: FirstGameExperience
  label: string
  navigation?: NavigationItem
  action?: GuidanceAction
}

export interface GuidanceModel {
  navigation: Record<NavigationItem, NavigationGuidance>
  recommendedAction: GuidanceAction
  checklist: ChecklistItem[]
  checklistComplete: boolean
  checklistCollapsed: boolean
  needsSkipOrderConfirmation: boolean
}

const checklistItems: ChecklistItem[] = [
  { id: 'market-visited', label: '시장 화면 방문', navigation: '시장' },
  { id: 'asset-detail-viewed', label: '종목 상세 확인', navigation: '시장' },
  { id: 'order-or-skip-confirmed', label: '첫 주문 접수 또는 주문 없이 진행 선택', navigation: '시장' },
  { id: 'market-opened', label: '장 시작', action: 'open-session' },
  { id: 'market-closed', label: '장 마감', action: 'close-session' },
  { id: 'next-day-advanced', label: '다음 게임일 이동', action: 'next-day' },
]

export function selectGuidance(state: GameSave): GuidanceModel {
  const completed = new Set(state.guidance.experienced)
  const recommendedAction: GuidanceAction = state.marketSessionPhase === 'preopen'
    ? completed.has('market-visited') ? 'open-session' : 'open-market'
    : state.marketSessionPhase === 'opened' ? 'close-session' : 'next-day'
  const importantEvents = state.pendingImportantEvents.length
  const importantNews = state.pendingImportantNews.length
  const paymentFailures = state.loan.status === 'overdue' ? state.loan.consecutiveMissedMonths : 0

  return {
    navigation: {
      홈: { isRecommended: recommendedAction !== 'open-market' },
      시장: { isRecommended: recommendedAction === 'open-market', isExperienced: completed.has('market-visited') },
      포트폴리오: importantEvents > 0 ? { attentionCount: importantEvents, attentionReason: `확인이 필요한 중요 기업 이벤트 ${importantEvents}건` } : {},
      뉴스: importantNews > 0 ? { attentionCount: importantNews, attentionReason: `확인이 필요한 중요 뉴스 ${importantNews}건` } : {},
      자산: paymentFailures > 0 ? { attentionCount: paymentFailures, attentionReason: `확인이 필요한 결제 실패 ${paymentFailures}건` } : {},
    },
    recommendedAction,
    checklist: checklistItems.filter((item) => !completed.has(item.id)),
    checklistComplete: checklistItems.every((item) => completed.has(item.id)),
    checklistCollapsed: state.guidance.checklistCollapsed,
    needsSkipOrderConfirmation: state.marketSessionPhase === 'preopen' && state.pendingOrders.length === 0 && !state.guidance.skipOrderConfirmationShown,
  }
}
