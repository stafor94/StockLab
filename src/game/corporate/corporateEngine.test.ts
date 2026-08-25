import { describe, expect, it } from 'vitest'
import { findFirstImportantCorporateStopDate, processCorporateEventsToDate } from './corporateEngine'
import type { CorporateActionState, CorporateEvent } from './types'

function state(overrides: Partial<CorporateActionState> = {}): CorporateActionState {
  return {
    krwCash: 0,
    usdCash: 0,
    positions: [],
    pendingOrders: [],
    assetRestrictions: {},
    corporateHistory: [],
    pendingImportantEvents: [],
    ...overrides,
  }
}

const source = { provider: 'TEST', reference: 'fixture' }

describe('corporate action engine', () => {
  it('credits dividend net of the event-specific withholding rate', () => {
    const event: CorporateEvent = {
      id: 'E1', assetId: 'K001', date: '2018-01-03', timing: 'PRE_OPEN', type: 'DIVIDEND', title: '배당', summary: '테스트 배당', important: false, source,
      payload: { cashPerShare: 1000, currency: 'KRW', withholdingRate: 0.154 },
    }
    const outcome = processCorporateEventsToDate(state({ positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 50000 }] }), '2018-01-02', '2018-01-03', [event], ['2018-01-02', '2018-01-03'])
    expect(outcome.state.krwCash).toBeCloseTo(8460)
    expect(outcome.records[0].cashDelta).toBeCloseTo(8460)
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
