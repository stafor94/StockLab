export type LoanStatus = 'current' | 'overdue' | 'paid'
export type LoanEventType = 'interest_due' | 'interest_paid' | 'payment_failed' | 'principal_repayment' | 'paid_off'

export interface LoanEvent {
  id: string
  date: string
  type: LoanEventType
  amount: number
  note: string
}

export interface LoanAccountState {
  principal: number
  status: LoanStatus
  originationDate: string
  lastProcessedDate: string
  accruedInterest: number
  pastDueInterest: number
  overdueCharge: number
  pastDueSince: string | null
  consecutiveMissedMonths: number
  history: LoanEvent[]
  nextEventNumber: number
}

export interface LoanGameOverState {
  date: string
  reason: 'THREE_MONTHS_INTEREST_OVERDUE'
}

export interface LoanAdvanceContext {
  baseRates: import('../../types/rates').BaseRateSeries
  bankBusinessDates: string[]
}

export interface LoanAdvanceState {
  krwCash: number
  loan: LoanAccountState
  gameOver: LoanGameOverState | null
}

export interface LoanAdvanceOutcome extends LoanAdvanceState {
  events: LoanEvent[]
}

export interface LoanRepaymentOutcome {
  krwCash: number
  loan: LoanAccountState
  event: LoanEvent
}
