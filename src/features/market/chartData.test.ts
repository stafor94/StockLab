import { describe, expect, it } from 'vitest'
import type { DailyBar } from '../../types/market'
import { getChartBars, getKnownFullBars } from './chartData'

const bars: DailyBar[] = [
  { date: '2018-01-02', open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { date: '2018-01-03', open: 11, high: 13, low: 10, close: 12, volume: 120 },
  { date: '2018-02-01', open: 12, high: 14, low: 11, close: 13, volume: 140 },
]

describe('phase-aware chart visibility', () => {
  it('hides the current full OHLC bar before and during the session', () => {
    expect(getKnownFullBars(bars, '2018-01-03', 'preopen').map((bar) => bar.date)).toEqual(['2018-01-02'])
    expect(getKnownFullBars(bars, '2018-01-03', 'opened').map((bar) => bar.date)).toEqual(['2018-01-02'])
  })

  it('reveals the current full OHLC bar only after market close', () => {
    expect(getKnownFullBars(bars, '2018-01-03', 'closed').map((bar) => bar.date)).toEqual(['2018-01-02', '2018-01-03'])
  })

  it('keeps only the requested historical window', () => {
    expect(getChartBars(bars, '2018-02-02', '1M', 'preopen').map((bar) => bar.date)).toEqual([
      '2018-01-02',
      '2018-01-03',
      '2018-02-01',
    ])
    expect(getChartBars(bars, '2018-02-02', 'ALL', 'preopen')).toHaveLength(3)
  })
})
