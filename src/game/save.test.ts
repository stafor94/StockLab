import { describe, expect, it } from 'vitest'
import { migrateGameSave, SAVE_SCHEMA_VERSION } from './save'

describe('save migration', () => {
  it('migrates legacy top-level loan state into the current loan account', () => {
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

  it('migrates v4 trade history by adding the v5 cost breakdown without changing old economics', () => {
    const migrated = migrateGameSave({
      schemaVersion: 4,
      gameDate: '2018-02-01',
      trades: [{
        orderId: 'O000001', assetId: 'K001', market: 'KR', currency: 'KRW', side: 'sell', quantity: 1,
        price: 100_000, grossAmount: 100_000, commission: 15, cashAmount: 99_985,
        executedDate: '2018-01-31', settlementDate: '2018-02-02',
      }],
    }, 4)

    expect(migrated.trades[0]).toMatchObject({
      commission: 15,
      transactionTax: 0,
      ruralSpecialTax: 0,
      secSection31Fee: 0,
      finraTaf: 0,
      totalFees: 15,
      cashAmount: 99_985,
    })
    expect(migrated.schemaVersion).toBe(5)
  })

  it('still migrates v1 saves without losing cash balances', () => {
    const migrated = migrateGameSave({ schemaVersion: 1, gameDate: '2018-01-10', krwCash: 7_000_000, usdCash: 0, loanPrincipal: 10_000_000 }, 1)
    expect(migrated.krwCash).toBe(7_000_000)
    expect(migrated.loan.principal).toBe(10_000_000)
    expect(migrated.schemaVersion).toBe(5)
  })
})
