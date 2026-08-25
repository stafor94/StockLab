import { describe, expect, it } from 'vitest'
import { executeMarketOpenOrders, validateOrderPlacement } from './orderEngine'
import type { TradingAccountState } from './types'

function state(overrides: Partial<TradingAccountState> = {}): TradingAccountState {
  return {
    krwCash: 1_000_000,
    usdCash: 0,
    marketSessionPhase: 'preopen',
    positions: [],
    pendingOrders: [],
    pendingSettlements: [],
    trades: [],
    ...overrides,
  }
}

describe('market open order engine', () => {
  it('amount buy reduces quantity until the open-price cost plus fee fits the budget', () => {
    const source = state({
      pendingOrders: [{
        id: 'O000001', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02',
        kind: 'buy-amount', requestedAmount: 1_000_000,
      }],
    })
    const outcome = executeMarketOpenOrders(source, {
      date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: {},
    })

    expect(outcome.results[0].status).toBe('filled')
    expect(outcome.results[0].trade?.quantity).toBe(9)
    expect(outcome.state.krwCash).toBe(99_865)
    expect(outcome.state.positions[0]).toMatchObject({ assetId: 'K001', quantity: 9, averagePrice: 100_000 })
  })

  it('cancels a quantity buy when a gap-up makes the requested shares unaffordable', () => {
    const source = state({
      pendingOrders: [{
        id: 'O000002', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02',
        kind: 'buy-quantity', requestedQuantity: 10,
      }],
    })
    const outcome = executeMarketOpenOrders(source, {
      date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: {},
    })

    expect(outcome.results[0]).toMatchObject({ status: 'cancelled', reason: 'insufficient-cash' })
    expect(outcome.state.krwCash).toBe(1_000_000)
    expect(outcome.state.positions).toHaveLength(0)
  })

  it('puts sell proceeds into settlement instead of immediately increasing cash', () => {
    const source = state({
      krwCash: 0,
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 90_000 }],
      pendingOrders: [{
        id: 'O000003', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'sell-all',
      }],
    })
    const outcome = executeMarketOpenOrders(source, {
      date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: { K001: '2018-01-04' },
    })

    expect(outcome.state.krwCash).toBe(0)
    expect(outcome.state.positions).toHaveLength(0)
    expect(outcome.state.pendingSettlements[0]).toMatchObject({ amount: 999_850, settlementDate: '2018-01-04' })
  })

  it('reserves holdings against duplicate sell orders before the market opens', () => {
    const source = state({
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 5, averagePrice: 90_000 }],
      pendingOrders: [{
        id: 'O1', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'sell-quantity', requestedQuantity: 4,
      }],
    })
    expect(validateOrderPlacement(source, {
      assetId: 'K001', market: 'KR', currency: 'KRW', kind: 'sell-quantity', requestedQuantity: 2,
    })).toContain('초과')
  })
})
