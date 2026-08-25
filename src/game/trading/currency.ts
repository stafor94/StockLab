import type { AssetCurrency } from '../../types/market'

export function roundCurrency(value: number, currency: AssetCurrency): number {
  if (currency === 'KRW') return Math.floor(value + 1e-9)
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function ceilUsdCent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.ceil((value - 1e-12) * 100) / 100
}
