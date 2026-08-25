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
      pendingOrders: [], pendingSettlements: [], trades: [], nextOrderNumber: 4,
      exchangeHistory: [], nextExchangeNumber: 2, marketSessionPhase: 'preopen',
    }, 3)
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.loan.principal).toBe(9_000_000)
    expect(migrated.loan.status).toBe('overdue')
    expect(migrated.positions).toHaveLength(1)
    expect(migrated.assetRestrictions).toEqual({})
    expect(migrated.readNewsIds).toEqual([])
    expect(migrated.pendingImportantNews).toEqual([])
  })

  it('migrates v4 trade history without changing old economics', () => {
    const migrated = migrateGameSave({ schemaVersion: 4, gameDate: '2018-02-01', trades: [{ orderId: 'O000001', assetId: 'K001', market: 'KR', currency: 'KRW', side: 'sell', quantity: 1, price: 100_000, grossAmount: 100_000, commission: 15, cashAmount: 99_985, executedDate: '2018-01-31', settlementDate: '2018-02-02' }] }, 4)
    expect(migrated.trades[0]).toMatchObject({ commission: 15, transactionTax: 0, ruralSpecialTax: 0, secSection31Fee: 0, finraTaf: 0, totalFees: 15, cashAmount: 99_985 })
    expect(migrated.schemaVersion).toBe(7)
  })

  it('preserves v6 corporate state and initializes v7 news state', () => {
    const migrated = migrateGameSave({
      schemaVersion: 6,
      assetRestrictions: { K001: { halted: true, delisted: false } },
      corporateHistory: [{ eventId: 'CE1', assetId: 'K001', date: '2018-02-01', type: 'HALT', timing: 'PRE_OPEN', title: '거래정지', summary: '정지', note: '적용', cashDelta: 0, quantityBefore: 1, quantityAfter: 1 }],
      pendingImportantEvents: [],
    }, 6)
    expect(migrated.assetRestrictions.K001.halted).toBe(true)
    expect(migrated.corporateHistory).toHaveLength(1)
    expect(migrated.readNewsIds).toEqual([])
    expect(migrated.pendingImportantNews).toEqual([])
  })

  it('preserves v7 read and pending important news records', () => {
    const migrated = migrateGameSave({
      schemaVersion: 7,
      readNewsIds: ['N1', 'N1'],
      pendingImportantNews: [{ newsId: 'N2', publishedDate: '2018-02-01', revealDate: '2018-02-02', timing: 'POST_CLOSE', category: 'MARKET', market: 'GLOBAL', headline: '중요 뉴스', summary: '요약' }],
    }, 7)
    expect(migrated.readNewsIds).toEqual(['N1'])
    expect(migrated.pendingImportantNews).toHaveLength(1)
  })

  it('still migrates v1 saves without losing cash balances', () => {
    const migrated = migrateGameSave({ schemaVersion: 1, gameDate: '2018-01-10', krwCash: 7_000_000, usdCash: 0, loanPrincipal: 10_000_000 }, 1)
    expect(migrated.krwCash).toBe(7_000_000)
    expect(migrated.loan.principal).toBe(10_000_000)
    expect(migrated.schemaVersion).toBe(7)
  })
})
