import type { AssetCurrency, MarketCode } from '../../types/market'
import { roundCurrency } from './currency'
import { calculateHistoricalSellCosts } from './historicalCosts'

export { roundCurrency } from './currency'

export const WS_BROKER_NAME = 'WS증권'

export const WS_COMMISSION_RATE: Record<MarketCode, number> = {
  KR: 0.00015,
  US: 0.0007,
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
  assetId: string,
  market: MarketCode,
  currency: AssetCurrency,
  tradeDate: string,
): {
  grossAmount: number
  commission: number
  transactionTax: number
  ruralSpecialTax: number
  secSection31Fee: number
  finraTaf: number
  totalFees: number
  net: number
} {
  const grossAmount = roundCurrency(quantity * openPrice, currency)
  const commission = calculateCommission(grossAmount, market, currency)
  const costs = calculateHistoricalSellCosts({
    assetId,
    market,
    grossAmount,
    quantity,
    unitPrice: openPrice,
    tradeDate,
  })
  const totalFees = roundCurrency(commission + costs.total, currency)
  return {
    grossAmount,
    commission,
    transactionTax: costs.transactionTax,
    ruralSpecialTax: costs.ruralSpecialTax,
    secSection31Fee: costs.secSection31Fee,
    finraTaf: costs.finraTaf,
    totalFees,
    net: roundCurrency(grossAmount - totalFees, currency),
  }
}
