import { describe, expect, it } from 'vitest'
import { createInitialLoan } from '../save'
import type { BaseRateSeries } from '../../types/rates'
import { processLoanToDate, repayLoanPrincipal } from './loanEngine'

const baseRates: BaseRateSeries = {
  schemaVersion: 1,
  name: 'BOK_BASE_RATE',
  coverage: { from: '2018-01-01', to: '2018-04-30' },
  rates: [{ date: '2017-11-30', annualRate: 1.5 }],
  source: { provider: 'Bank of Korea', statCode: '722Y001', itemCode: '0101000', mode: 'bootstrap', generatedAt: 'test' },
}

const bankBusinessDates = ['2018-02-01', '2018-02-02', '2018-03-01', '2018-04-02']

describe('WS Bank loan engine', () => {
  it('accrues daily variable interest and auto-debits on the first bank business day', () => {
    const outcome = processLoanToDate({ krwCash: 100_000, loan: createInitialLoan(), gameOver: null }, '2018-02-01', { baseRates, bankBusinessDates })
    expect(outcome.events.map((event) => event.type)).toEqual(['interest_due', 'interest_paid'])
    expect(outcome.events[0].amount).toBe(38_219)
    expect(outcome.krwCash).toBe(61_781)
    expect(outcome.loan.status).toBe('current')
    expect(outcome.loan.pastDueInterest).toBe(0)
  })

  it('retries a failed debit on the next bank business day after cash becomes available', () => {
    const failed = processLoanToDate({ krwCash: 0, loan: createInitialLoan(), gameOver: null }, '2018-02-01', { baseRates, bankBusinessDates })
    expect(failed.loan.status).toBe('overdue')
    expect(failed.loan.consecutiveMissedMonths).toBe(1)

    const retried = processLoanToDate({ krwCash: 40_000, loan: failed.loan, gameOver: null }, '2018-02-02', { baseRates, bankBusinessDates })
    expect(retried.loan.status).toBe('current')
    expect(retried.loan.consecutiveMissedMonths).toBe(0)
    expect(retried.loan.pastDueInterest).toBe(0)
    expect(retried.events.at(-1)?.type).toBe('interest_paid')
  })

  it('ends the game after three consecutive monthly interest-payment failures', () => {
    const outcome = processLoanToDate({ krwCash: 0, loan: createInitialLoan(), gameOver: null }, '2018-04-02', { baseRates, bankBusinessDates })
    expect(outcome.loan.consecutiveMissedMonths).toBe(3)
    expect(outcome.loan.status).toBe('overdue')
    expect(outcome.gameOver).toEqual({ date: '2018-04-02', reason: 'THREE_MONTHS_INTEREST_OVERDUE' })
  })

  it('allows 1,000,000 KRW principal repayments and settles accrued interest on full payoff', () => {
    const loan = createInitialLoan()
    loan.accruedInterest = 1_234.2
    const partial = repayLoanPrincipal({ krwCash: 10_000_000, loan }, 1_000_000, '2018-01-15')
    expect(partial.loan.principal).toBe(9_000_000)
    expect(partial.loan.accruedInterest).toBe(1_234.2)
    expect(partial.krwCash).toBe(9_000_000)

    const payoff = repayLoanPrincipal({ krwCash: 9_001_235, loan: partial.loan }, 9_000_000, '2018-01-15')
    expect(payoff.loan.principal).toBe(0)
    expect(payoff.loan.accruedInterest).toBe(0)
    expect(payoff.loan.status).toBe('paid')
    expect(payoff.krwCash).toBe(0)
  })
})
