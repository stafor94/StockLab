import { describe, expect, it } from 'vitest'
import type { AssetPriceSeries } from '../../types/market'
import { selectMarketQuote } from './marketQuote'

const series: AssetPriceSeries = {
  version: 1,
  id: 'K001',
  bars: [
    { date: '2018-01-02', open: 100, high: 110, low: 95, close: 105, volume: 1000 },
    { date: '2018-01-03', open: 108, high: 120, low: 106, close: 115, volume: 1100 },
    { date: '2018-01-04', open: 112, high: 118, low: 100, close: 101, volume: 1200 },
  ],
}

describe('selectMarketQuote', () => {
  it('uses the latest known close before open and compares it with the prior close', () => {
    expect(selectMarketQuote(series, '2018-01-04', 'preopen')).toEqual({
      price: 115,
      priceDate: '2018-01-03',
      source: 'previous-close',
      comparisonClose: 105,
      changeRate: ((115 - 105) / 105) * 100,
    })
  })

  it('uses only today open during the opened phase and compares it with yesterday close', () => {
    const quote = selectMarketQuote(series, '2018-01-04', 'opened')
    expect(quote?.price).toBe(112)
    expect(quote?.source).toBe('today-open')
    expect(quote?.comparisonClose).toBe(115)
    expect(quote?.changeRate).toBeCloseTo(((112 - 115) / 115) * 100)
  })

  it('uses today close only after market close', () => {
    const quote = selectMarketQuote(series, '2018-01-04', 'closed')
    expect(quote?.price).toBe(101)
    expect(quote?.source).toBe('today-close')
    expect(quote?.comparisonClose).toBe(115)
    expect(quote?.changeRate).toBeCloseTo(((101 - 115) / 115) * 100)
  })

  it('falls back to the latest completed close when the asset has no bar today', () => {
    const quote = selectMarketQuote(series, '2018-01-05', 'opened')
    expect(quote?.price).toBe(101)
    expect(quote?.source).toBe('previous-close')
    expect(quote?.comparisonClose).toBe(115)
  })
})
