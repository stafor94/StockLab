import { describe, expect, it } from 'vitest'
import { formatMoney, formatSignedMoney } from './money'

describe('money formatting', () => {
  it('renders KRW amounts with the won unit after the number', () => {
    expect(formatMoney(1234567, 'KRW')).toBe('1,234,567원')
    expect(formatSignedMoney(6800, 'KRW')).toBe('+6,800원')
    expect(formatSignedMoney(-6800, 'KRW')).toBe('-6,800원')
  })

  it('keeps USD amounts dollar-prefixed and supports fixed decimals', () => {
    expect(formatMoney(12.5, 'USD')).toBe('$12.5')
    expect(formatMoney(12.5, 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('$12.50')
  })
})
