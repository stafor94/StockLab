import { describe, expect, it } from 'vitest'
import { migrateGameSave, SAVE_SCHEMA_VERSION } from './save'

describe('save migration', () => {
  it('migrates v1 cash and loan state into the v2 trading schema', () => {
    const migrated = migrateGameSave({
      schemaVersion: 1,
      gameDate: '2018-02-01',
      krwCash: 8_500_000,
      usdCash: 0,
      loanPrincipal: 10_000_000,
      loanStatus: 'current',
      consecutiveMissedInterestMonths: 0,
    }, 1)

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.gameDate).toBe('2018-02-01')
    expect(migrated.krwCash).toBe(8_500_000)
    expect(migrated.marketSessionPhase).toBe('preopen')
    expect(migrated.positions).toEqual([])
    expect(migrated.pendingOrders).toEqual([])
    expect(migrated.pendingSettlements).toEqual([])
    expect(migrated.nextOrderNumber).toBe(1)
  })
})
