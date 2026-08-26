export type ProgressGuidanceSeverity = 'info' | 'warning' | 'critical'

export type ProgressActionTarget =
  | 'OPEN_SESSION'
  | 'CLOSE_SESSION'
  | 'REVIEW_NEWS'
  | 'REVIEW_EVENT'
  | 'REVIEW_CASH_LOAN'
  | 'RETRY_DATA'
  | 'REVIEW_PERFORMANCE'
  | 'ADVANCE_DATE'

export interface ProgressGuidanceResult {
  severity: ProgressGuidanceSeverity
  title: string
  description: string
  actionLabel: string
  actionTarget: ProgressActionTarget
}
