import { describe, expect, it } from 'vitest'
import { canAdvanceFromSession, closeMarketSession } from './sessionEngine'
import type { TradingAccountState } from './types'

const baseState: TradingAccountState = {
  krwCash: 10_000_000,
  usdCash: 0,
  marketSessionPhase: 'opened',
  positions: [],
  pendingOrders: [],
  pendingSettlements: [],
  trades: [],
}

describe('market session engine', () => {
  it('closes only after the market has opened', () => {
    expect(closeMarketSession(baseState).marketSessionPhase).toBe('closed')
    expect(() => closeMarketSession({ ...baseState, marketSessionPhase: 'preopen' })).toThrow('장 시작 전에는 마감할 수 없습니다.')
  })

  it('requires a trading date to be closed before advancing', () => {
    expect(canAdvanceFromSession(true, 'preopen')).toBe(false)
    expect(canAdvanceFromSession(true, 'opened')).toBe(false)
    expect(canAdvanceFromSession(true, 'closed')).toBe(true)
    expect(canAdvanceFromSession(false, 'preopen')).toBe(true)
  })
})
