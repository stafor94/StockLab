import { describe, expect, it } from 'vitest'
import { closeMarketSession } from './sessionEngine'
import type { TradingAccountState } from './types'

const baseState: TradingAccountState = {
  krwCash: 10_000_000,
  usdCash: 0,
  marketSessions: {
    KR: { phase: 'opened', tradingDate: '2018-01-02' },
    US: { phase: 'preopen', tradingDate: null },
  },
  positions: [],
  pendingOrders: [],
  pendingSettlements: [],
  trades: [],
}

describe('market session engine', () => {
  it('closes only the requested market after it has opened', () => {
    const closed = closeMarketSession(baseState, 'KR', '2018-01-02')
    expect(closed.marketSessions.KR).toEqual({ phase: 'closed', tradingDate: '2018-01-02' })
    expect(closed.marketSessions.US).toEqual(baseState.marketSessions.US)
  })

  it('rejects a close before that market opens or for a mismatched trading date', () => {
    const preopen = {
      ...baseState,
      marketSessions: { ...baseState.marketSessions, KR: { phase: 'preopen' as const, tradingDate: null } },
    }
    expect(() => closeMarketSession(preopen, 'KR', '2018-01-02')).toThrow('해당 시장이 시작되기 전에는 마감할 수 없습니다.')
    expect(() => closeMarketSession(baseState, 'KR', '2018-01-03')).toThrow('해당 시장이 시작되기 전에는 마감할 수 없습니다.')
  })

  it('is idempotent for an already closed matching market session', () => {
    const closed = closeMarketSession(baseState, 'KR', '2018-01-02')
    expect(closeMarketSession(closed, 'KR', '2018-01-02')).toBe(closed)
  })
})
