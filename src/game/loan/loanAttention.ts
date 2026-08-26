import type { LoanAccountState } from './types'

export function countLoanPaymentFailures(loan: LoanAccountState): number {
  const recordedFailures = loan.history.reduce(
    (count, event) => count + (event.type === 'payment_failed' ? 1 : 0),
    0,
  )
  const legacyConsecutiveFailures = loan.status === 'overdue' ? loan.consecutiveMissedMonths : 0
  return Math.max(recordedFailures, legacyConsecutiveFailures)
}
