import { describe, expect, it } from 'vitest'
import committedFxHistory from '../../public/data/fx/usd-krw.json'
import { findUsdKrwRatePointForDate, quoteExchange } from '../game/exchange/exchangeEngine'
import { parseFxRateSeries } from './fxSchema'

const series = parseFxRateSeries(committedFxHistory)

function expectRate(date: string, expected: number) {
  const point = series.rates.find((item) => item.date === date)
  expect(point?.usdKrw, date).toBe(expected)
}

describe('committed Bank of Korea USD/KRW history', () => {
  it('pins representative official ECOS observations', () => {
    expectRate('2017-12-29', 1071.4)
    expectRate('2018-01-02', 1071.4)
    expectRate('2018-01-03', 1064.3)
    expectRate('2026-08-21', 1393)
    expectRate('2026-08-25', 1380.6)
  })

  it('has an official carry-in observation for the 2018-01-01 game start', () => {
    const point = findUsdKrwRatePointForDate(series, '2018-01-01')
    expect(point).toEqual({ date: '2017-12-29', usdKrw: 1071.4 })
  })

  it('never uses a later observation for a historical lookup', () => {
    const point = findUsdKrwRatePointForDate(series, '2018-01-06')
    expect(point).not.toBeNull()
    if (!point) throw new Error('Expected a prior published USD/KRW rate')
    expect(point.date).toBe('2018-01-05')
    expect(point.date <= '2018-01-06').toBe(true)
  })

  it('quotes both exchange directions from the committed historical rate', () => {
    const point = findUsdKrwRatePointForDate(series, '2018-01-02')
    expect(point).not.toBeNull()
    if (!point) throw new Error('Expected a published USD/KRW rate')
    const buyUsd = quoteExchange({ direction: 'KRW_TO_USD', amount: 100_000 }, point.usdKrw)
    const sellUsd = quoteExchange({ direction: 'USD_TO_KRW', amount: 100 }, point.usdKrw)
    expect(buyUsd.referenceRate).toBe(1071.4)
    expect(sellUsd.referenceRate).toBe(1071.4)
    expect(buyUsd.appliedRate).toBeGreaterThan(point.usdKrw)
    expect(sellUsd.appliedRate).toBeLessThan(point.usdKrw)
  })
})
