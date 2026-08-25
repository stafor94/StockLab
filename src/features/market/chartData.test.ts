import { describe, expect, it } from 'vitest'
import type { DailyBar } from '../../types/market'
import { getChartBars, getKnownBarsForPreOpen } from './chartData'

const bars: DailyBar[] = [
  { date: '2018-01-02', open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { date: '2018-01-03', open: 11, high: 13, low: 10, close: 12, volume: 120 },
  { date: '2018-02-01', open: 12, high: 14, low: 11, close: 13, volume: 140 },
]

describe('pre-open chart visibility', () => {
  it('never exposes the current game date bar before open', () => {
    expect(getKnownBarsForPreOpen(bars, '2018-01-03').map((bar) => bar.date)).toEqual(['2018-01-02'])
  })

  it('keeps only the requested historical window', () => {
    expect(getChartBars(bars, '2018-02-02', '1M').map((bar) => bar.date)).toEqual([
      '2018-01-02',
      '2018-01-03',
      '2018-02-01',
    ])
    expect(getChartBars(bars, '2018-02-02', 'ALL')).toHaveLength(3)
  })
})
