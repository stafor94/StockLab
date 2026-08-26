import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findUsdKrwRatePointForDate } from '../game/exchange/exchangeEngine'
import { parseFxRateSeries } from './fxSchema'

const series = parseFxRateSeries(JSON.parse(
  readFileSync(new URL('../../public/data/fx/usd-krw.json', import.meta.url), 'utf8'),
) as unknown)

function expectRate(date: string, expected: number) {
  const point = series.rates.find((item) => item.date === date)
  expect(point?.usdKrw, date).toBe(expected)
}

describe('committed Bank of Korea USD/KRW history', () => {
  it('pins representative official ECOS observations', () => {
    expectRate('2018-01-02', 1071.4)
    expectRate('2018-01-03', 1064.3)
    expectRate('2026-08-21', 1393)
    expectRate('2026-08-25', 1380.6)
  })

  it('has an official carry-in observation for the 2018-01-01 game start', () => {
    const point = findUsdKrwRatePointForDate(series, '2018-01-01')
    expect(point).not.toBeNull()
    expect(point?.date < '2018-01-01').toBe(true)
  })

  it('never uses a later observation for a historical lookup', () => {
    const point = findUsdKrwRatePointForDate(series, '2018-01-06')
    expect(point?.date).toBe('2018-01-05')
    expect(point?.date <= '2018-01-06').toBe(true)
  })
})
