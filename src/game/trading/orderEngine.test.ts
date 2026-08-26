import { describe, expect, it } from 'vitest'
import {
  executeMarketOpenOrders,
  executeOpenPriceOrder,
  validateOpenPriceOrderPlacement,
  validateOrderPlacement,
} from './orderEngine'
import type { MarketOrder, TradingAccountState } from './types'

function state(overrides: Partial<TradingAccountState> = {}): TradingAccountState {
  return { krwCash: 1_000_000, usdCash: 0, marketSessionPhase: 'preopen', positions: [], pendingOrders: [], pendingSettlements: [], trades: [], ...overrides }
}

describe('market open order engine', () => {
  it('amount buy reduces quantity until the open-price cost plus fee fits the budget', () => {
    const source = state({ pendingOrders: [{ id: 'O000001', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'buy-amount', requestedAmount: 1_000_000 }] })
    const outcome = executeMarketOpenOrders(source, { date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: {} })
    expect(outcome.results[0].status).toBe('filled')
    expect(outcome.results[0].trade?.quantity).toBe(9)
    expect(outcome.state.krwCash).toBe(99_865)
    expect(outcome.state.positions[0]).toMatchObject({ assetId: 'K001', quantity: 9, averagePrice: 100_000 })
    expect(outcome.results[0].trade).toMatchObject({ commission: 135, transactionTax: 0, totalFees: 135, costBasis: null, realizedPnl: null })
  })

  it('cancels a quantity buy when a gap-up makes the requested shares unaffordable', () => {
    const source = state({ pendingOrders: [{ id: 'O000002', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'buy-quantity', requestedQuantity: 10 }] })
    const outcome = executeMarketOpenOrders(source, { date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: {} })
    expect(outcome.results[0]).toMatchObject({ status: 'cancelled', reason: 'insufficient-cash' })
    expect(outcome.state.krwCash).toBe(1_000_000)
    expect(outcome.state.positions).toHaveLength(0)
  })

  it('deducts historical Korean sell taxes and persists realized pnl', () => {
    const source = state({
      krwCash: 0,
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 90_000 }],
      pendingOrders: [{ id: 'O000003', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'sell-all' }],
    })
    const outcome = executeMarketOpenOrders(source, { date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: { K001: '2018-01-04' } })
    expect(outcome.state.krwCash).toBe(0)
    expect(outcome.state.positions).toHaveLength(0)
    expect(outcome.state.pendingSettlements[0]).toMatchObject({ amount: 996_850, settlementDate: '2018-01-04' })
    expect(outcome.results[0].trade).toMatchObject({ commission: 150, transactionTax: 1500, ruralSpecialTax: 1500, totalFees: 3150, cashAmount: 996_850, costBasis: 900_000, realizedPnl: 96_850 })
  })

  it('deducts U.S. Section 31 and FINRA TAF pass-through costs on sells', () => {
    const source = state({ usdCash: 0, positions: [{ assetId: 'U001', market: 'US', currency: 'USD', quantity: 100, averagePrice: 90 }], pendingOrders: [{ id: 'O000004', assetId: 'U001', market: 'US', currency: 'USD', tradeDate: '2026-04-06', kind: 'sell-all' }] })
    const outcome = executeMarketOpenOrders(source, { date: '2026-04-06', openPrices: { U001: 100 }, settlementDates: { U001: '2026-04-07' } })
    expect(outcome.results[0].trade).toMatchObject({ grossAmount: 10_000, commission: 7, secSection31Fee: 0.21, finraTaf: 0.02, totalFees: 7.23, cashAmount: 9992.77, costBasis: 9000, realizedPnl: 992.77 })
    expect(outcome.state.pendingSettlements[0].amount).toBe(9992.77)
  })

  it('reserves holdings against duplicate sell orders before the market opens', () => {
    const source = state({ positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 5, averagePrice: 90_000 }], pendingOrders: [{ id: 'O1', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'sell-quantity', requestedQuantity: 4 }] })
    expect(validateOrderPlacement(source, { assetId: 'K001', market: 'KR', currency: 'KRW', kind: 'sell-quantity', requestedQuantity: 2 })).toContain('초과')
  })

  it('allows an opened-session quantity buy only when the exact open-price total fits cash', () => {
    const opened = state({ marketSessionPhase: 'opened' })
    const input = { assetId: 'K001', market: 'KR' as const, currency: 'KRW' as const, kind: 'buy-quantity' as const, requestedQuantity: 10 }
    expect(validateOpenPriceOrderPlacement(opened, input, 99_000)).toBeNull()
    expect(validateOpenPriceOrderPlacement(opened, input, 100_000)).toContain('총 필요 금액')
  })

  it('executes an additional buy immediately at the already revealed open price', () => {
    const opened = state({ marketSessionPhase: 'opened' })
    const order: MarketOrder = { id: 'O000005', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'buy-quantity', requestedQuantity: 5 }
    const outcome = executeOpenPriceOrder(opened, order, { date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: {} })
    expect(outcome.result.status).toBe('filled')
    expect(outcome.result.trade).toMatchObject({ quantity: 5, price: 100_000, cashAmount: 500_075 })
    expect(outcome.state.krwCash).toBe(499_925)
    expect(outcome.state.marketSessionPhase).toBe('opened')
  })

  it('executes an opened-session sell at the same open price and creates settlement', () => {
    const opened = state({
      marketSessionPhase: 'opened',
      krwCash: 0,
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 100, averagePrice: 90_000 }],
    })
    const order: MarketOrder = { id: 'O000006', assetId: 'K001', market: 'KR', currency: 'KRW', tradeDate: '2018-01-02', kind: 'sell-quantity', requestedQuantity: 25 }
    const outcome = executeOpenPriceOrder(opened, order, { date: '2018-01-02', openPrices: { K001: 100_000 }, settlementDates: { K001: '2018-01-04' } })
    expect(outcome.result.status).toBe('filled')
    expect(outcome.result.trade).toMatchObject({ quantity: 25, price: 100_000, settlementDate: '2018-01-04' })
    expect(outcome.state.positions[0].quantity).toBe(75)
    expect(outcome.state.pendingSettlements).toHaveLength(1)
  })
})
