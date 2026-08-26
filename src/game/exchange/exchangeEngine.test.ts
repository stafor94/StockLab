import { describe, expect, it } from 'vitest'
import { executeExchange, findUsdKrwRateForDate, quoteExchange, WS_FX_EFFECTIVE_SPREAD_RATE } from './exchangeEngine'
import type { FxRateSeries } from '../../types/fx'

const series: FxRateSeries = {
  schemaVersion: 1,
  pair: 'USD/KRW',
  coverage: { from: '2017-12-29', to: '2018-01-05' },
  rates: [
    { date: '2017-12-29', usdKrw: 1071.4 },
    { date: '2018-01-02', usdKrw: 1071.4 },
    { date: '2018-01-05', usdKrw: 1062.7 },
  ],
  source: {
    provider: 'Bank of Korea ECOS',
    statCode: '731Y001',
    itemCode: '0000001',
    frequency: 'D',
    endpoint: 'https://ecos.bok.or.kr/api/StatisticSearch',
    generatedAt: '2026-08-25T00:00:00Z',
  },
}

const state = {
  krwCash: 1_000_000,
  usdCash: 100,
  marketSessionPhase: 'preopen' as const,
  exchangeHistory: [],
  nextExchangeNumber: 1,
}

describe('WS Securities FX engine', () => {
  it('uses a 0.05% effective spread after 95% preferential pricing', () => {
    expect(WS_FX_EFFECTIVE_SPREAD_RATE).toBeCloseTo(0.0005)
    expect(quoteExchange({ direction: 'KRW_TO_USD', amount: 100_000 }, 1000).appliedRate).toBeCloseTo(1000.5)
    expect(quoteExchange({ direction: 'USD_TO_KRW', amount: 100 }, 1000).appliedRate).toBeCloseTo(999.5)
  })

  it('uses only the latest BOK rate available on or before the game date', () => {
    expect(findUsdKrwRateForDate(series, '2018-01-01')).toBe(1071.4)
    expect(findUsdKrwRateForDate(series, '2018-01-04')).toBe(1071.4)
    expect(findUsdKrwRateForDate(series, '2018-01-05')).toBe(1062.7)
    expect(findUsdKrwRateForDate(series, '2017-12-28')).toBeNull()
  })

  it('uses the prior published rate across weekends without looking ahead', () => {
    expect(findUsdKrwRateForDate(series, '2018-01-06')).toBe(1062.7)
    expect(findUsdKrwRateForDate(series, '2018-01-07')).toBe(1062.7)
  })

  it('converts KRW to USD and records the exchange', () => {
    const result = executeExchange(state, { direction: 'KRW_TO_USD', amount: 100_000 }, 1000, '2018-01-02')
    expect(result.state.krwCash).toBe(900_000)
    expect(result.state.usdCash).toBeGreaterThan(199)
    expect(result.record.id).toBe('E000001')
    expect(result.state.exchangeHistory).toHaveLength(1)
  })

  it('converts USD to KRW with the same spread rule', () => {
    const result = executeExchange(state, { direction: 'USD_TO_KRW', amount: 50 }, 1000, '2018-01-02')
    expect(result.state.usdCash).toBe(50)
    expect(result.state.krwCash).toBe(1_049_975)
    expect(result.record.direction).toBe('USD_TO_KRW')
  })

  it('does not permit exchange after the market-open phase', () => {
    expect(() => executeExchange({ ...state, marketSessionPhase: 'opened' }, { direction: 'KRW_TO_USD', amount: 100_000 }, 1000, '2018-01-02')).toThrow(/개장 전/)
  })
})
