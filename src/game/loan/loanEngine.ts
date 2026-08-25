import type { BaseRateSeries } from '../../types/rates'
import {
  getWsLoanAnnualRate,
  getWsOverdueAnnualRate,
  WS_PRINCIPAL_REPAYMENT_UNIT,
} from './rateRules'
import type {
  LoanAccountState,
  LoanAdvanceContext,
  LoanAdvanceOutcome,
  LoanEvent,
  LoanRepaymentOutcome,
} from './types'

const DAY_MS = 86_400_000

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function addDays(date: string, days: number): string {
  return new Date(parseDate(date).getTime() + (days * DAY_MS)).toISOString().slice(0, 10)
}

function monthKey(date: string): string {
  return date.slice(0, 7)
}

function cloneLoan(loan: LoanAccountState): LoanAccountState {
  return { ...loan, history: [...loan.history] }
}

function nextEvent(loan: LoanAccountState, date: string, type: LoanEvent['type'], amount: number, note: string): LoanEvent {
  const event: LoanEvent = {
    id: `L${String(loan.nextEventNumber).padStart(6, '0')}`,
    date,
    type,
    amount,
    note,
  }
  loan.nextEventNumber += 1
  loan.history.push(event)
  return event
}

function isFirstBankBusinessDayOfMonth(date: string, businessDates: Set<string>): boolean {
  if (!businessDates.has(date)) return false
  const prefix = `${date.slice(0, 7)}-`
  const day = Number(date.slice(8, 10))
  for (let candidateDay = 1; candidateDay < day; candidateDay += 1) {
    if (businessDates.has(`${prefix}${String(candidateDay).padStart(2, '0')}`)) return false
  }
  return true
}

function totalPastDue(loan: LoanAccountState): number {
  return Math.ceil(loan.pastDueInterest + loan.overdueCharge)
}

function tryAutoDebit(loan: LoanAccountState, krwCash: number, date: string, events: LoanEvent[]): number {
  const due = totalPastDue(loan)
  if (due <= 0 || krwCash < due) return krwCash
  krwCash -= due
  events.push(nextEvent(loan, date, 'interest_paid', due, 'WS은행 자동 재출금으로 미납 이자를 납부했습니다.'))
  loan.pastDueInterest = 0
  loan.overdueCharge = 0
  loan.pastDueSince = null
  loan.consecutiveMissedMonths = 0
  loan.status = loan.principal > 0 ? 'current' : 'paid'
  return krwCash
}

function accrueNormalInterest(loan: LoanAccountState, rates: BaseRateSeries, date: string): void {
  if (loan.principal <= 0) return
  const annualRate = getWsLoanAnnualRate(rates, date)
  loan.accruedInterest += loan.principal * (annualRate / 100) / 365
}

function accrueOverdueCharge(loan: LoanAccountState, rates: BaseRateSeries, date: string): void {
  if (loan.pastDueInterest <= 0 || !loan.pastDueSince || date <= loan.pastDueSince) return
  const annualRate = getWsOverdueAnnualRate(rates, date)
  loan.overdueCharge += loan.pastDueInterest * (annualRate / 100) / 365
}

export function processLoanToDate(
  state: { krwCash: number; loan: LoanAccountState; gameOver: LoanAdvanceOutcome['gameOver'] },
  targetDate: string,
  context: LoanAdvanceContext,
): LoanAdvanceOutcome {
  if (targetDate < state.loan.lastProcessedDate) throw new Error('대출 처리 날짜를 과거로 되돌릴 수 없습니다.')
  const loan = cloneLoan(state.loan)
  let krwCash = state.krwCash
  let gameOver = state.gameOver
  const events: LoanEvent[] = []
  const businessDates = new Set(context.bankBusinessDates)

  while (!gameOver && loan.lastProcessedDate < targetDate) {
    const currentDate = addDays(loan.lastProcessedDate, 1)
    const previousDate = loan.lastProcessedDate

    accrueNormalInterest(loan, context.baseRates, previousDate)
    accrueOverdueCharge(loan, context.baseRates, previousDate)

    const isDueDate = loan.principal > 0
      && monthKey(currentDate) > monthKey(loan.originationDate)
      && isFirstBankBusinessDayOfMonth(currentDate, businessDates)

    if (isDueDate) {
      const billedInterest = Math.max(0, Math.round(loan.accruedInterest))
      loan.accruedInterest = 0
      if (billedInterest > 0) {
        loan.pastDueInterest += billedInterest
        loan.pastDueSince ??= currentDate
        events.push(nextEvent(loan, currentDate, 'interest_due', billedInterest, '전월 사용분 대출이자가 청구되었습니다.'))
      }

      const beforeDebit = totalPastDue(loan)
      krwCash = tryAutoDebit(loan, krwCash, currentDate, events)
      if (beforeDebit > 0 && totalPastDue(loan) > 0) {
        loan.status = 'overdue'
        loan.consecutiveMissedMonths += 1
        events.push(nextEvent(loan, currentDate, 'payment_failed', beforeDebit, `자동출금 실패 · 연속 ${loan.consecutiveMissedMonths}개월 미납`))
        if (loan.consecutiveMissedMonths >= 3) {
          gameOver = { date: currentDate, reason: 'THREE_MONTHS_INTEREST_OVERDUE' }
        }
      }
    } else if (loan.pastDueInterest > 0 && businessDates.has(currentDate)) {
      krwCash = tryAutoDebit(loan, krwCash, currentDate, events)
    }

    loan.lastProcessedDate = currentDate
  }

  return { krwCash, loan, gameOver, events }
}

export function repayLoanPrincipal(
  state: { krwCash: number; loan: LoanAccountState },
  requestedAmount: number,
  date: string,
): LoanRepaymentOutcome {
  const loan = cloneLoan(state.loan)
  if (loan.status === 'paid' || loan.principal <= 0) throw new Error('이미 대출을 모두 상환했습니다.')
  if (loan.status === 'overdue' || loan.pastDueInterest > 0) throw new Error('연체 이자를 먼저 정상화해야 원금을 상환할 수 있습니다.')
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) throw new Error('상환 금액을 확인해주세요.')

  const principalAmount = Math.min(Math.round(requestedAmount), loan.principal)
  const isFullPayoff = principalAmount === loan.principal
  if (!isFullPayoff && principalAmount % WS_PRINCIPAL_REPAYMENT_UNIT !== 0) {
    throw new Error('중도상환은 100만원 단위로 가능합니다.')
  }

  const accruedPayoffInterest = isFullPayoff ? Math.ceil(loan.accruedInterest) : 0
  const totalCashNeeded = principalAmount + accruedPayoffInterest
  if (state.krwCash < totalCashNeeded) throw new Error('원화 현금이 부족합니다.')

  loan.principal -= principalAmount
  if (isFullPayoff) {
    loan.accruedInterest = 0
    loan.status = 'paid'
  }

  const note = isFullPayoff
    ? `대출 전액상환 · 미청구 이자 ₩${accruedPayoffInterest.toLocaleString('ko-KR')} 포함`
    : '대출 원금을 중도상환했습니다.'
  const event = nextEvent(loan, date, isFullPayoff ? 'paid_off' : 'principal_repayment', totalCashNeeded, note)
  return { krwCash: state.krwCash - totalCashNeeded, loan, event }
}

export function getNextLoanPaymentDate(currentDate: string, originationDate: string, bankBusinessDates: string[]): string | null {
  const businessDates = new Set(bankBusinessDates)
  for (let cursor = addDays(currentDate, 1); cursor <= bankBusinessDates.at(-1)!; cursor = addDays(cursor, 1)) {
    if (monthKey(cursor) <= monthKey(originationDate)) continue
    if (isFirstBankBusinessDayOfMonth(cursor, businessDates)) return cursor
  }
  return null
}
