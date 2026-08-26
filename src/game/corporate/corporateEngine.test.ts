import { describe, expect, it } from 'vitest'
import { findFirstImportantCorporateStopDate, processCorporateEventsToDate } from './corporateEngine'
import type { CorporateActionState, CorporateEvent } from './types'
import type { TradeExecution } from '../trading/types'

function state(overrides: Partial<CorporateActionState> = {}): CorporateActionState {
  return {
    krwCash: 0,
    usdCash: 0,
    positions: [],
    pendingOrders: [],
    trades: [],
    assetRestrictions: {},
    corporateHistory: [],
    pendingImportantEvents: [],
    ...overrides,
  }
}

function trade(overrides: Partial<TradeExecution> & Pick<TradeExecution, 'orderId' | 'assetId' | 'market' | 'currency' | 'side' | 'quantity' | 'executedDate'>): TradeExecution {
  return {
    price: 1,
    grossAmount: overrides.quantity,
    commission: 0,
    transactionTax: 0,
    ruralSpecialTax: 0,
    secSection31Fee: 0,
    finraTaf: 0,
    totalFees: 0,
    cashAmount: overrides.quantity,
    costBasis: null,
    realizedPnl: null,
    settlementDate: null,
    ...overrides,
  }
}

const source = { provider: 'TEST', reference: 'fixture' }

describe('corporate action engine', () => {
  it('credits dividend from the ex-date entitlement even after the shares are sold', () => {
    const event: CorporateEvent = {
      id: 'E1', assetId: 'K001', date: '2018-01-05', timing: 'PRE_OPEN', type: 'DIVIDEND', title: '배당', summary: '테스트 배당', important: false, source,
      payload: {
        declarationDate: '2018-01-02', exDate: '2018-01-03', recordDate: '2018-01-04', paymentDate: '2018-01-05',
        cashPerShare: 1000, currency: 'KRW', withholdingRate: 0.154,
      },
    }
    const trades = [
      trade({ orderId: 'O1', assetId: 'K001', market: 'KR', currency: 'KRW', side: 'buy', quantity: 10, executedDate: '2018-01-02' }),
      trade({ orderId: 'O2', assetId: 'K001', market: 'KR', currency: 'KRW', side: 'sell', quantity: 10, executedDate: '2018-01-04' }),
    ]
    const outcome = processCorporateEventsToDate(state({ positions: [], trades }), '2018-01-04', '2018-01-05', [event], ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05'])
    expect(outcome.state.krwCash).toBeCloseTo(8460)
    expect(outcome.records[0]).toMatchObject({ cashDelta: 8460, quantityBefore: 10, quantityAfter: 10 })
  })

  it('does not grant dividend entitlement to shares bought on the ex-date', () => {
    const event: CorporateEvent = {
      id: 'E1B', assetId: 'U005', date: '2018-01-05', timing: 'PRE_OPEN', type: 'DIVIDEND', title: '배당', summary: '테스트 배당', important: false, source,
      payload: {
        declarationDate: '2018-01-02', exDate: '2018-01-03', recordDate: '2018-01-04', paymentDate: '2018-01-05',
        cashPerShare: 1, currency: 'USD', withholdingRate: 0.15,
      },
    }
    const trades = [trade({ orderId: 'O3', assetId: 'U005', market: 'US', currency: 'USD', side: 'buy', quantity: 10, executedDate: '2018-01-03' })]
    const outcome = processCorporateEventsToDate(state({ positions: [{ assetId: 'U005', market: 'US', currency: 'USD', quantity: 10, averagePrice: 10 }], trades }), '2018-01-04', '2018-01-05', [event], ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05'])
    expect(outcome.state.usdCash).toBe(0)
    expect(outcome.records[0]).toMatchObject({ cashDelta: 0, quantityBefore: 0, quantityAfter: 0 })
  })

  it('replays pre-ex-date splits when reconstructing dividend entitlement', () => {
    const split: CorporateEvent = {
      id: 'E1C-S', assetId: 'U005', date: '2018-01-03', timing: 'PRE_OPEN', type: 'SPLIT', title: '분할', summary: '2대1 분할', important: true, source,
      payload: { numerator: 2, denominator: 1 },
    }
    const dividend: CorporateEvent = {
      id: 'E1C-D', assetId: 'U005', date: '2018-01-05', timing: 'PRE_OPEN', type: 'DIVIDEND', title: '배당', summary: '테스트 배당', important: false, source,
      payload: {
        declarationDate: '2018-01-02', exDate: '2018-01-04', recordDate: '2018-01-04', paymentDate: '2018-01-05',
        cashPerShare: 1, currency: 'USD', withholdingRate: 0,
      },
    }
    const trades = [trade({ orderId: 'O4', assetId: 'U005', market: 'US', currency: 'USD', side: 'buy', quantity: 3, executedDate: '2018-01-02' })]
    const outcome = processCorporateEventsToDate(state({ positions: [{ assetId: 'U005', market: 'US', currency: 'USD', quantity: 6, averagePrice: 5 }], trades }), '2018-01-04', '2018-01-05', [split, dividend], ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05'])
    expect(outcome.state.usdCash).toBe(6)
    expect(outcome.records[0]).toMatchObject({ cashDelta: 6, quantityBefore: 6, quantityAfter: 6 })
  })

  it('pays USD dividends on payment date with withholding without mutating the position cost basis', () => {
    const event: CorporateEvent = {
      id: 'E1D', assetId: 'U005', date: '2018-01-05', timing: 'PRE_OPEN', type: 'DIVIDEND', title: '배당', summary: '테스트 배당', important: false, source,
      payload: {
        declarationDate: '2018-01-02', exDate: '2018-01-03', recordDate: '2018-01-04', paymentDate: '2018-01-05',
        cashPerShare: 2, currency: 'USD', withholdingRate: 0.15,
      },
    }
    const trades = [trade({ orderId: 'O5', assetId: 'U005', market: 'US', currency: 'USD', side: 'buy', quantity: 10, executedDate: '2018-01-02' })]
    const positions = [{ assetId: 'U005', market: 'US' as const, currency: 'USD' as const, quantity: 10, averagePrice: 50 }]
    const outcome = processCorporateEventsToDate(state({ positions, trades }), '2018-01-04', '2018-01-05', [event], ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05'])

    expect(outcome.state.usdCash).toBeCloseTo(17)
    expect(outcome.records[0]).toMatchObject({ cashDelta: 17, quantityBefore: 10, quantityAfter: 10 })
    expect(outcome.state.positions[0]).toEqual(positions[0])
  })

  it('adjusts split quantity and average cost while preserving whole-share policy', () => {
    const event: CorporateEvent = {
      id: 'E2', assetId: 'U001', date: '2018-01-03', timing: 'PRE_OPEN', type: 'SPLIT', title: '분할', summary: '4대1 분할', important: true, source,
      payload: { numerator: 4, denominator: 1 },
    }
    const outcome = processCorporateEventsToDate(state({ positions: [{ assetId: 'U001', market: 'US', currency: 'USD', quantity: 3, averagePrice: 120 }] }), '2018-01-02', '2018-01-03', [event], ['2018-01-02', '2018-01-03'])
    expect(outcome.state.positions[0]).toMatchObject({ quantity: 12, averagePrice: 30 })
    expect(outcome.state.pendingImportantEvents).toHaveLength(1)
  })

  it('blocks a halted asset and cancels its pending orders', () => {
    const event: CorporateEvent = {
      id: 'E3', assetId: 'K001', date: '2018-01-03', timing: 'PRE_OPEN', type: 'HALT', title: '거래정지', summary: '거래정지', important: true, source, payload: {},
    }
    const outcome = processCorporateEventsToDate(state({ pendingOrders: [{ id: 'O1', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-03', kind: 'buy-quantity', requestedQuantity: 1 }] }), '2018-01-02', '2018-01-03', [event], ['2018-01-02', '2018-01-03'])
    expect(outcome.state.assetRestrictions.K001.halted).toBe(true)
    expect(outcome.state.pendingOrders).toHaveLength(0)
  })

  it('reveals post-close events on the next gameplay date and stops there', () => {
    const event: CorporateEvent = {
      id: 'E4', assetId: 'K001', date: '2018-01-03', timing: 'POST_CLOSE', type: 'DELISTING', title: '상장폐지', summary: '상장폐지 결정', important: true, source, payload: {},
    }
    expect(findFirstImportantCorporateStopDate('2018-01-02', '2018-01-10', [event], new Set(), ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05'])).toBe('2018-01-04')
  })

  it('cash-settles a delisting when the event provides an authoritative cash-out price', () => {
    const event: CorporateEvent = {
      id: 'E5', assetId: 'U001', date: '2018-01-03', timing: 'PRE_OPEN', type: 'DELISTING', title: '상장폐지', summary: '현금정산', important: true, source, payload: { cashOutPerShare: 25 },
    }
    const outcome = processCorporateEventsToDate(state({ positions: [{ assetId: 'U001', market: 'US', currency: 'USD', quantity: 4, averagePrice: 10 }] }), '2018-01-02', '2018-01-03', [event], ['2018-01-02', '2018-01-03'])
    expect(outcome.state.usdCash).toBe(100)
    expect(outcome.state.positions).toHaveLength(0)
    expect(outcome.state.assetRestrictions.U001.delisted).toBe(true)
  })
})
