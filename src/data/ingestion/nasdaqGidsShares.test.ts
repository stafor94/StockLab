import { describe, expect, it } from 'vitest'
import { parseNormalizedNasdaqGidsSharesCsv } from './nasdaqGidsShares'

describe('parseNormalizedNasdaqGidsSharesCsv', () => {
  it('parses normalized authoritative TSO input', () => {
    expect(parseNormalizedNasdaqGidsSharesCsv('date,symbol,totalSharesOutstanding\n2018-01-02,SPY,1000000\n')).toEqual([
      { date: '2018-01-02', symbol: 'SPY', totalSharesOutstanding: 1000000 },
    ])
  })
})
