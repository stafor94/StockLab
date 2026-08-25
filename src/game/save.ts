import {
  GAME_START_DATE,
  INITIAL_KRW_CASH,
  INITIAL_LOAN_PRINCIPAL,
  INITIAL_USD_CASH,
} from './constants'

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
    gameDate: GAME_START_DATE,
    krwCash: INITIAL_KRW_CASH,
    usdCash: INITIAL_USD_CASH,
    loanPrincipal: INITIAL_LOAN_PRINCIPAL,
    loanStatus: 'current',
    consecutiveMissedInterestMonths: 0,
  }
}
