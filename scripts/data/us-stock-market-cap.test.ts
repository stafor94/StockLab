import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssetPriceSeries } from '../../src/types/market'
import { buildUsStockMarketCapSeries } from './us-stock-market-cap'

function prices(bars: AssetPriceSeries['bars']): AssetPriceSeries {
  return {
    schemaVersion: 1,
    id: 'U900',
    market: 'US',
    kind: 'stock',
    currency: 'USD',
    bars,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tracked SEC U.S. market-cap build', () => {
  it('uses strict filing availability and carries only the previous close into preopen', () => {
    const inputPrices = prices([
      { date: '2026-01-05', open: 10, high: 11, low: 9, close: 11, volume: 1 },
      { date: '2026-01-06', open: 12, high: 13, low: 11, close: 13, volume: 2 },
      { date: '2026-01-07', open: 14, high: 15, low: 13, close: 15, volume: 3 },
    ])
    const before = structuredClone(inputPrices)
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network access is forbidden')))
    vi.stubGlobal('fetch', fetchSpy)

    const result = buildUsStockMarketCapSeries(
      'U900',
      inputPrices,
      [
        { asOfDate: '2026-01-02', availableFrom: '2026-01-03', sharesOutstanding: 100, form: '10-K' },
        { asOfDate: '2026-01-05', availableFrom: '2026-01-06', sharesOutstanding: 200, form: '10-Q' },
      ],
      [],
      '2026-08-30T00:00:00.000Z',
    )

    expect(result.bars).toEqual([
      { date: '2026-01-05', preopen: null, open: 1_000, close: 1_100 },
      { date: '2026-01-06', preopen: 1_100, open: 1_200, close: 1_300 },
      { date: '2026-01-07', preopen: 1_300, open: 2_800, close: 3_000 },
    ])
    expect(inputPrices).toEqual(before)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aligns pre-split snapshot shares to a post-split unadjusted price date', () => {
    const result = buildUsStockMarketCapSeries(
      'U900',
      prices([
        { date: '2026-01-07', open: 50, high: 56, low: 49, close: 55, volume: 10 },
      ]),
      [
        { asOfDate: '2026-01-05', availableFrom: '2026-01-06', sharesOutstanding: 100, form: '10-Q' },
      ],
      [{ effectiveDate: '2026-01-07', numerator: 2, denominator: 1 }],
      '2026-08-30T00:00:00.000Z',
    )

    expect(result.bars).toEqual([
      { date: '2026-01-07', preopen: null, open: 10_000, close: 11_000 },
    ])
  })
})
