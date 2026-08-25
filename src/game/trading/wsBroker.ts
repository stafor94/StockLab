import type { AssetCurrency, MarketCode } from '../../types/market'

export const WS_BROKER_NAME = 'WS증권'

export const WS_COMMISSION_RATE: Record<MarketCode, number> = {
  KR: 0.00015,
  US: 0.0007,
}

export function roundCurrency(value: number, currency: AssetCurrency): number {
  if (currency === 'KRW') return Math.floor(value + 1e-9)
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateCommission(
  grossAmount: number,
  market: MarketCode,
  currency: AssetCurrency,
): number {
  return roundCurrency(grossAmount * WS_COMMISSION_RATE[market], currency)
}

export function calculateBuyCashRequired(
  quantity: number,
  openPrice: number,
  market: MarketCode,
  currency: AssetCurrency,
): { grossAmount: number; commission: number; total: number } {
  const grossAmount = roundCurrency(quantity * openPrice, currency)
  const commission = calculateCommission(grossAmount, market, currency)
  return { grossAmount, commission, total: roundCurrency(grossAmount + commission, currency) }
}

export function calculateSellProceeds(
  quantity: number,
  openPrice: number,
  market: MarketCode,
  currency: AssetCurrency,
): { grossAmount: number; commission: number; net: number } {
  const grossAmount = roundCurrency(quantity * openPrice, currency)
  const commission = calculateCommission(grossAmount, market, currency)
  return { grossAmount, commission, net: roundCurrency(grossAmount - commission, currency) }
}
