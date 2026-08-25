export const SAVE_STORAGE_KEY = 'stocklab.save'
export const SAVE_SCHEMA_VERSION = 1

export type LoanStatus = 'current' | 'overdue' | 'paid'

export interface GameSave {
  schemaVersion: number
  gameDate: string
  krwCash: number
  usdCash: number
  loanPrincipal: number
  loanStatus: LoanStatus
  consecutiveMissedInterestMonths: number
}

export function createInitialSave(): GameSave {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameDate: '2018-01-01',
    krwCash: 10_000_000,
    usdCash: 0,
    loanPrincipal: 10_000_000,
    loanStatus: 'current',
    consecutiveMissedInterestMonths: 0,
  }
}
