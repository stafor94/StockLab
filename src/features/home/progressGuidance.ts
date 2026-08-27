export type ProgressGuidanceSeverity = 'info' | 'warning' | 'critical'
export type ProgressActionTarget = 'RUN_PRIMARY' | 'REVIEW_NEWS' | 'REVIEW_EVENT' | 'REVIEW_CASH_LOAN' | 'RETRY_DATA' | 'REVIEW_PERFORMANCE'

export interface ProgressGuidanceResult {
  severity: ProgressGuidanceSeverity
  title: string
  description: string
  actionLabel: string
  actionTarget: ProgressActionTarget
}

export interface ProgressGuidanceInput {
  primaryActionLabel: string
  timelineMessage: string
  timelineReady: boolean
  pendingImportantNews: number
  pendingImportantEvents: number
  loanOverdue: boolean
  gameOver: boolean
}

export function createProgressGuidance(input: ProgressGuidanceInput): ProgressGuidanceResult {
  if (input.gameOver) return { severity: 'critical', title: '게임이 종료되었습니다', description: input.timelineMessage, actionLabel: '최종 성과 확인', actionTarget: 'REVIEW_PERFORMANCE' }
  if (input.pendingImportantNews > 0) return { severity: 'critical', title: '중요 뉴스를 확인하세요', description: `${input.pendingImportantNews}건의 중요 뉴스 확인 후 진행할 수 있습니다.`, actionLabel: '뉴스 확인', actionTarget: 'REVIEW_NEWS' }
  if (input.pendingImportantEvents > 0) return { severity: 'critical', title: '중요 기업 이벤트를 확인하세요', description: `${input.pendingImportantEvents}건의 중요 기업 이벤트 확인 후 진행할 수 있습니다.`, actionLabel: '이벤트 확인', actionTarget: 'REVIEW_EVENT' }
  if (input.loanOverdue) return { severity: 'warning', title: '대출 상태를 확인하세요', description: input.timelineMessage, actionLabel: '현금·대출 확인', actionTarget: 'REVIEW_CASH_LOAN' }
  if (!input.timelineReady) return { severity: 'warning', title: '필수 데이터를 확인하는 중입니다', description: input.timelineMessage, actionLabel: '다시 시도', actionTarget: 'RETRY_DATA' }
  return {
    severity: 'info',
    title: '다음 시장 이벤트',
    description: input.timelineMessage,
    actionLabel: input.primaryActionLabel,
    actionTarget: 'RUN_PRIMARY',
  }
}
