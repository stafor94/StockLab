import type { AssetCurrency } from '../types/market'

export type MoneyFormatOptions = Pick<Intl.NumberFormatOptions, 'minimumFractionDigits' | 'maximumFractionDigits'>

export function formatMoney(value: number, currency: AssetCurrency, options: MoneyFormatOptions = {}): string {
  const formatted = new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
    ...options,
  }).format(value)
  return currency === 'KRW' ? `${formatted}원` : `$${formatted}`
}

export function formatSignedMoney(value: number, currency: AssetCurrency, options: MoneyFormatOptions = {}): string {
  return `${value >= 0 ? '+' : '-'}${formatMoney(Math.abs(value), currency, options)}`
}
