import { describe, expect, it } from 'vitest'
import { migrateGameSave, SAVE_SCHEMA_VERSION } from './save'

describe('save migration', () => {
  it('migrates legacy top-level loan state into the v4 loan account', () => {
    const migrated = migrateGameSave({
      schemaVersion: 3,
      gameDate: '2018-02-01',
      krwCash: 8_500_000,
      usdCash: 120,
      loanPrincipal: 9_000_000,
      loanStatus: 'overdue',
      consecutiveMissedInterestMonths: 1,
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 50_000 }],
      pendingOrders: [],
      pendingSettlements: [],
      trades: [],
      nextOrderNumber: 4,
      exchangeHistory: [],
      nextExchangeNumber: 2,
      marketSessionPhase: 'preopen',
    }, 3)

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.loan.principal).toBe(9_000_000)
    expect(migrated.loan.status).toBe('overdue')
    expect(migrated.loan.consecutiveMissedMonths).toBe(1)
    expect(migrated.loan.lastProcessedDate).toBe('2018-02-01')
    expect(migrated.positions).toHaveLength(1)
    expect(migrated.nextOrderNumber).toBe(4)
    expect(migrated.nextExchangeNumber).toBe(2)
    expect(migrated.gameOver).toBeNull()
  })

  it('still migrates v1 saves without losing cash balances', () => {
    const migrated = migrateGameSave({ schemaVersion: 1, gameDate: '2018-01-10', krwCash: 7_000_000, usdCash: 0, loanPrincipal: 10_000_000 }, 1)
    expect(migrated.krwCash).toBe(7_000_000)
    expect(migrated.loan.principal).toBe(10_000_000)
    expect(migrated.schemaVersion).toBe(4)
  })
})
