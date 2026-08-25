import { describe, expect, it } from 'vitest'
import { migrateGameSave, SAVE_SCHEMA_VERSION } from './save'

describe('save migration', () => {
  it('migrates v1 cash and loan state into the current schema', () => {
    const migrated = migrateGameSave({ schemaVersion: 1, gameDate: '2018-02-01', krwCash: 8_500_000, usdCash: 0, loanPrincipal: 10_000_000, loanStatus: 'current', consecutiveMissedInterestMonths: 0 }, 1)
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.gameDate).toBe('2018-02-01')
    expect(migrated.krwCash).toBe(8_500_000)
    expect(migrated.marketSessionPhase).toBe('preopen')
    expect(migrated.positions).toEqual([])
    expect(migrated.exchangeHistory).toEqual([])
    expect(migrated.nextExchangeNumber).toBe(1)
  })

  it('migrates v2 trading state without losing positions or orders and initializes FX history', () => {
    const migrated = migrateGameSave({ schemaVersion: 2, gameDate: '2018-03-02', krwCash: 5_000_000, usdCash: 120, positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 50000 }], pendingOrders: [], pendingSettlements: [], trades: [], nextOrderNumber: 4, marketSessionPhase: 'preopen' }, 2)
    expect(migrated.positions).toHaveLength(1)
    expect(migrated.nextOrderNumber).toBe(4)
    expect(migrated.exchangeHistory).toEqual([])
    expect(migrated.nextExchangeNumber).toBe(1)
    expect(migrated.schemaVersion).toBe(3)
  })
})
