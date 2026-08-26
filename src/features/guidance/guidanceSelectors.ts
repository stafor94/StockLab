import type { MarketSessionPhase } from '../../game/trading/types'

export type GuidanceStep = 'review-alert' | 'resolve-error' | 'pause-autoplay' | 'place-order' | 'open-market' | 'close-market' | 'next-day'

export interface GuidanceState {
  phase: MarketSessionPhase
  pendingImportantAlert: boolean
  autoplayRunning: boolean
  error: string | null
  pendingOrderCount: number
}

export interface NextAction {
  step: GuidanceStep
  title: string
  description: string
  actionLabel: string
}

export function selectNextAction(state: GuidanceState): NextAction {
  if (state.pendingImportantAlert) return { step: 'review-alert', title: '중요 알림을 확인하세요', description: '알림을 확인하면 게임을 계속 진행할 수 있습니다.', actionLabel: '알림 확인' }
  if (state.error) return { step: 'resolve-error', title: '진행 오류를 확인하세요', description: state.error, actionLabel: '다시 확인' }
  if (state.autoplayRunning) return { step: 'pause-autoplay', title: '자동진행 중입니다', description: '중요한 변화가 생기면 자동으로 멈춥니다.', actionLabel: '진행 보기' }
  if (state.phase === 'opened') return { step: 'close-market', title: '오늘 장을 마감하세요', description: '종가와 오늘의 전체 가격 범위를 확인합니다.', actionLabel: '장 마감' }
  if (state.phase === 'closed') return { step: 'next-day', title: '다음 게임일로 이동하세요', description: '오늘 거래가 끝났습니다.', actionLabel: '다음 날' }
  if (state.pendingOrderCount > 0) return { step: 'open-market', title: '주문을 시가에 체결하세요', description: `${state.pendingOrderCount}건의 주문이 개장을 기다리고 있습니다.`, actionLabel: '장 시작' }
  return { step: 'place-order', title: '종목을 살펴보거나 장을 시작하세요', description: '주문 없이도 장을 시작할 수 있습니다.', actionLabel: '시장 보기' }
}
