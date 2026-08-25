import { describe, expect, it } from 'vitest'
import { migrateGameSave, SAVE_SCHEMA_VERSION } from './save'

describe('save migration', () => {
  it('migrates legacy top-level loan state into the current loan account', () => {
    const migrated = migrateGameSave({
      schemaVersion: 3, gameDate: '2018-02-01', krwCash: 8_500_000, usdCash: 120,
      loanPrincipal: 9_000_000, loanStatus: 'overdue', consecutiveMissedInterestMonths: 1,
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 50_000 }],
      pendingOrders: [], pendingSettlements: [], trades: [], nextOrderNumber: 4,
      exchangeHistory: [], nextExchangeNumber: 2, marketSessionPhase: 'preopen',
    }, 3)
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.loan.principal).toBe(9_000_000)
    expect(migrated.positions).toHaveLength(1)
    expect(migrated.readNewsIds).toEqual([])
  })

  it('migrates legacy trade history without guessing realized cost basis', () => {
    const migrated = migrateGameSave({ schemaVersion: 7, trades: [{ orderId: 'O000001', assetId: 'K001', market: 'KR', currency: 'KRW', side: 'sell', quantity: 1, price: 100_000, grossAmount: 100_000, commission: 15, cashAmount: 99_985, executedDate: '2018-01-31', settlementDate: '2018-02-02' }] }, 7)
    expect(migrated.trades[0]).toMatchObject({ totalFees: 15, costBasis: null, realizedPnl: null, cashAmount: 99_985 })
    expect(migrated.schemaVersion).toBe(8)
  })

  it('preserves v8 realized trade fields', () => {
    const migrated = migrateGameSave({ schemaVersion: 8, trades: [{ orderId: 'O2', assetId: 'K001', market: 'KR', currency: 'KRW', side: 'sell', quantity: 2, price: 120, grossAmount: 240, commission: 1, transactionTax: 0, ruralSpecialTax: 0, secSection31Fee: 0, finraTaf: 0, totalFees: 1, cashAmount: 239, costBasis: 200, realizedPnl: 39, executedDate: '2018-02-02', settlementDate: '2018-02-06' }] }, 8)
    expect(migrated.trades[0]).toMatchObject({ costBasis: 200, realizedPnl: 39 })
  })

  it('preserves v7 news records while advancing schema', () => {
    const migrated = migrateGameSave({ schemaVersion: 7, readNewsIds: ['N1', 'N1'], pendingImportantNews: [{ newsId: 'N2', publishedDate: '2018-02-01', revealDate: '2018-02-02', timing: 'POST_CLOSE', category: 'MARKET', market: 'GLOBAL', headline: '중요 뉴스', summary: '요약' }] }, 7)
    expect(migrated.readNewsIds).toEqual(['N1'])
    expect(migrated.pendingImportantNews).toHaveLength(1)
    expect(migrated.schemaVersion).toBe(8)
  })

  it('still migrates v1 saves without losing cash balances', () => {
    const migrated = migrateGameSave({ schemaVersion: 1, gameDate: '2018-01-10', krwCash: 7_000_000, usdCash: 0, loanPrincipal: 10_000_000 }, 1)
    expect(migrated.krwCash).toBe(7_000_000)
    expect(migrated.loan.principal).toBe(10_000_000)
    expect(migrated.schemaVersion).toBe(8)
  })
})
