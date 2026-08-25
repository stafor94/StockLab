import { describe, expect, it } from 'vitest'
import type { MarketCalendar } from '../../types/market'
import { getSettlementDate, getSettlementLag } from './settlementRules'

function calendar(market: 'KR' | 'US', dates: string[]): MarketCalendar {
  return {
    schemaVersion: 1,
    market,
    timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
    coverage: { from: dates[0], to: dates.at(-1) ?? dates[0] },
    tradingDates: dates,
    closures: [],
    source: { authoritativeProvider: 'test', mode: 'generated', generatedAt: null },
  }
}

describe('settlement rules', () => {
  it('uses T+2 for Korean stocks', () => {
    const kr = calendar('KR', ['2018-01-02', '2018-01-03', '2018-01-04', '2018-01-05'])
    expect(getSettlementDate('KR', '2018-01-02', kr)).toBe('2018-01-04')
  })

  it('changes U.S. settlement from T+2 to T+1 on 2024-05-28', () => {
    expect(getSettlementLag('US', '2024-05-24')).toBe(2)
    expect(getSettlementLag('US', '2024-05-28')).toBe(1)
    const us = calendar('US', ['2024-05-28', '2024-05-29', '2024-05-30'])
    expect(getSettlementDate('US', '2024-05-28', us)).toBe('2024-05-29')
  })
})
