import { describe, expect, it } from 'vitest'
import type { MarketSessionState } from '../../game/trading/types'
import type { DailyBar } from '../../types/market'
import { getChartBars, getKnownFullBars } from './chartData'

const bars: DailyBar[] = [
  { date: '2018-01-02', open: 10, high: 12, low: 9, close: 11, volume: 100 },
  { date: '2018-01-03', open: 11, high: 13, low: 10, close: 12, volume: 120 },
  { date: '2018-02-01', open: 12, high: 14, low: 11, close: 13, volume: 140 },
]

const session = (phase: MarketSessionState['phase'], tradingDate: string | null): MarketSessionState => ({ phase, tradingDate })

describe('market-session-aware chart visibility', () => {
  it('hides the current full OHLC bar before and during the session', () => {
    expect(getKnownFullBars(bars, '2018-01-03', session('preopen', null)).map((bar) => bar.date)).toEqual(['2018-01-02'])
    expect(getKnownFullBars(bars, '2018-01-03', session('opened', '2018-01-03')).map((bar) => bar.date)).toEqual(['2018-01-02'])
  })

  it('reveals the current full OHLC bar only after that market closes', () => {
    expect(getKnownFullBars(bars, '2018-01-03', session('closed', '2018-01-03')).map((bar) => bar.date)).toEqual(['2018-01-02', '2018-01-03'])
  })

  it('keeps a closed market pinned to its own last trading date while game time advances', () => {
    expect(getKnownFullBars(bars, '2018-02-02', session('closed', '2018-01-03')).map((bar) => bar.date)).toEqual(['2018-01-02', '2018-01-03'])
  })

  it('keeps only the requested historical window', () => {
    const preopen = session('preopen', null)
    expect(getChartBars(bars, '2018-02-02', '1M', preopen).map((bar) => bar.date)).toEqual([
      '2018-01-02',
      '2018-01-03',
      '2018-02-01',
    ])
    expect(getChartBars(bars, '2018-02-02', 'ALL', preopen)).toHaveLength(3)
  })
})
