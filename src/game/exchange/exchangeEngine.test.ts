import { describe, expect, it } from 'vitest'
import type { MarketSessionStates } from '../trading/types'
import type { FxRateSeries } from '../../types/fx'
import {
  executeExchange,
  findUsdKrwRateForDate,
  getFxSpreadRate,
  quoteExchange,
  WS_FX_BASE_SPREAD_RATE,
  WS_FX_EFFECTIVE_SPREAD_RATE,
} from './exchangeEngine'

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

const idleSessions: MarketSessionStates = {
  KR: { phase: 'preopen', tradingDate: null },
  US: { phase: 'preopen', tradingDate: null },
}

const krOpenSessions: MarketSessionStates = {
  KR: { phase: 'opened', tradingDate: '2018-01-02' },
  US: { phase: 'preopen', tradingDate: null },
}

const usOpenSessions: MarketSessionStates = {
  KR: { phase: 'closed', tradingDate: '2018-01-02' },
  US: { phase: 'opened', tradingDate: '2018-01-02' },
}

const state = {
  krwCash: 1_000_000,
  usdCash: 100,
  marketSessions: idleSessions,
  exchangeHistory: [],
  nextExchangeNumber: 1,
}

describe('WS Securities FX engine', () => {
  it('applies the 95% preferential rate only while the Korean market is open', () => {
    expect(WS_FX_EFFECTIVE_SPREAD_RATE).toBeCloseTo(0.0005)
    expect(getFxSpreadRate(idleSessions)).toBe(WS_FX_BASE_SPREAD_RATE)
    expect(getFxSpreadRate(krOpenSessions)).toBeCloseTo(WS_FX_EFFECTIVE_SPREAD_RATE)
    expect(getFxSpreadRate(usOpenSessions)).toBe(WS_FX_BASE_SPREAD_RATE)

    expect(quoteExchange({ direction: 'KRW_TO_USD', amount: 100_000 }, 1000, getFxSpreadRate(krOpenSessions)).appliedRate).toBeCloseTo(1000.5)
    expect(quoteExchange({ direction: 'USD_TO_KRW', amount: 100 }, 1000, getFxSpreadRate(krOpenSessions)).appliedRate).toBeCloseTo(999.5)
    expect(quoteExchange({ direction: 'KRW_TO_USD', amount: 100_000 }, 1000, getFxSpreadRate(idleSessions)).appliedRate).toBeCloseTo(1010)
    expect(quoteExchange({ direction: 'USD_TO_KRW', amount: 100 }, 1000, getFxSpreadRate(usOpenSessions)).appliedRate).toBeCloseTo(990)
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

  it('converts KRW to USD outside Korean market hours using the base spread', () => {
    const result = executeExchange(state, { direction: 'KRW_TO_USD', amount: 100_000 }, 1000, '2018-01-02')
    expect(result.state.krwCash).toBe(900_000)
    expect(result.state.usdCash).toBe(199)
    expect(result.record.spreadRate).toBe(WS_FX_BASE_SPREAD_RATE)
    expect(result.record.id).toBe('E000001')
    expect(result.state.exchangeHistory).toHaveLength(1)
  })

  it('converts USD to KRW outside Korean market hours using the base spread', () => {
    const result = executeExchange(state, { direction: 'USD_TO_KRW', amount: 50 }, 1000, '2018-01-02')
    expect(result.state.usdCash).toBe(50)
    expect(result.state.krwCash).toBe(1_049_500)
    expect(result.record.spreadRate).toBe(WS_FX_BASE_SPREAD_RATE)
    expect(result.record.direction).toBe('USD_TO_KRW')
  })

  it('permits exchange while the Korean market is open and applies the preferential spread', () => {
    const result = executeExchange({ ...state, marketSessions: krOpenSessions }, { direction: 'KRW_TO_USD', amount: 100_000 }, 1000, '2018-01-02')
    expect(result.record.spreadRate).toBeCloseTo(WS_FX_EFFECTIVE_SPREAD_RATE)
    expect(result.record.appliedRate).toBeCloseTo(1000.5)
    expect(result.state.usdCash).toBeGreaterThan(199.9)
  })

  it('permits exchange while only the U.S. market is open without Korean-market preference', () => {
    const result = executeExchange({ ...state, marketSessions: usOpenSessions }, { direction: 'KRW_TO_USD', amount: 100_000 }, 1000, '2018-01-02')
    expect(result.record.spreadRate).toBe(WS_FX_BASE_SPREAD_RATE)
    expect(result.record.appliedRate).toBeCloseTo(1010)
    expect(result.state.usdCash).toBe(199)
  })
})
