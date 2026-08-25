import { INITIAL_KRW_CASH, INITIAL_LOAN_PRINCIPAL } from '../constants'
import type { AssetPriceSeries } from '../../types/market'
import type { TradeExecution } from '../trading/types'
import type { PortfolioSnapshot, PortfolioSnapshotInput, ReturnBadgeTier } from './types'

export const RETURN_BADGE_TIERS: ReturnBadgeTier[] = [
  { id: 'recovery', label: '회복 모드', minReturn: Number.NEGATIVE_INFINITY, nextMinReturn: -30 },
  { id: 'apprentice', label: '시장 견습생', minReturn: -30, nextMinReturn: 0 },
  { id: 'beginner', label: '초보 투자자', minReturn: 0, nextMinReturn: 10 },
  { id: 'growth', label: '성장 투자자', minReturn: 10, nextMinReturn: 25 },
  { id: 'skilled', label: '숙련 투자자', minReturn: 25, nextMinReturn: 50 },
  { id: 'whale', label: '큰손', minReturn: 50, nextMinReturn: 100 },
  { id: 'master', label: '시장의 고수', minReturn: 100, nextMinReturn: 200 },
  { id: 'legend', label: '월가의 전설', minReturn: 200, nextMinReturn: null },
]

export function getReturnBadge(returnRate: number): ReturnBadgeTier {
  for (let index = RETURN_BADGE_TIERS.length - 1; index >= 0; index -= 1) {
    if (returnRate >= RETURN_BADGE_TIERS[index].minReturn) return RETURN_BADGE_TIERS[index]
  }
  return RETURN_BADGE_TIERS[0]
}

export function selectKnownValuationPrice(
  series: AssetPriceSeries,
  gameDate: string,
  phase: 'preopen' | 'opened',
) {
  if (phase === 'opened') {
    const today = series.bars.find((bar) => bar.date === gameDate)
    if (today) return { assetId: series.assetId, price: today.open, priceDate: today.date, source: 'today-open' as const }
  }
  const previous = [...series.bars].reverse().find((bar) => bar.date < gameDate)
  if (!previous) return null
  return { assetId: series.assetId, price: previous.close, priceDate: previous.date, source: 'previous-close' as const }
}

function convertToKrw(value: number, currency: 'KRW' | 'USD', usdKrwRate: number | null): number | null {
  if (currency === 'KRW') return value
  return usdKrwRate === null ? null : value * usdKrwRate
}

function hasUsdExposure(input: PortfolioSnapshotInput): boolean {
  return input.usdCash !== 0
    || input.positions.some((item) => item.currency === 'USD' && item.quantity > 0)
    || input.pendingSettlements.some((item) => item.currency === 'USD' && item.amount !== 0)
    || input.trades.some((item) => item.currency === 'USD' && (item.realizedPnl !== null || item.totalFees > 0))
}

function sumRealizedPnlKrw(trades: TradeExecution[], usdKrwRate: number | null): { value: number | null; incomplete: boolean } {
  let total = 0
  let incomplete = false
  for (const trade of trades) {
    if (trade.side !== 'sell') continue
    if (trade.realizedPnl === null) {
      incomplete = true
      continue
    }
    const converted = convertToKrw(trade.realizedPnl, trade.currency, usdKrwRate)
    if (converted === null) return { value: null, incomplete: true }
    total += converted
  }
  return { value: total, incomplete }
}

function sumFeesKrw(trades: TradeExecution[], usdKrwRate: number | null): number | null {
  let total = 0
  for (const trade of trades) {
    const converted = convertToKrw(trade.totalFees, trade.currency, usdKrwRate)
    if (converted === null) return null
    total += converted
  }
  return total
}

export function buildPortfolioSnapshot(input: PortfolioSnapshotInput): PortfolioSnapshot {
  const missingPriceAssetIds: string[] = []
  const positions = input.positions.map((position) => {
    const knownPrice = input.prices[position.assetId]
    if (!knownPrice) missingPriceAssetIds.push(position.assetId)
    const marketValue = knownPrice ? knownPrice.price * position.quantity : null
    const costBasis = position.averagePrice * position.quantity
    const unrealizedPnl = marketValue === null ? null : marketValue - costBasis
    const marketValueKrw = marketValue === null ? null : convertToKrw(marketValue, position.currency, input.usdKrwRate)
    const unrealizedPnlKrw = unrealizedPnl === null ? null : convertToKrw(unrealizedPnl, position.currency, input.usdKrwRate)
    return {
      assetId: position.assetId,
      quantity: position.quantity,
      currency: position.currency,
      averagePrice: position.averagePrice,
      price: knownPrice?.price ?? null,
      priceDate: knownPrice?.priceDate ?? null,
      priceSource: knownPrice?.source ?? null,
      marketValue,
      costBasis,
      unrealizedPnl,
      unrealizedRate: unrealizedPnl === null || costBasis === 0 ? null : (unrealizedPnl / costBasis) * 100,
      marketValueKrw,
      unrealizedPnlKrw,
    }
  })

  const needsFxRate = hasUsdExposure(input)
  const valuationComplete = missingPriceAssetIds.length === 0 && (!needsFxRate || input.usdKrwRate !== null)
  let grossAssetsKrw: number | null = null
  let unrealizedPnlKrw: number | null = null
  if (valuationComplete) {
    grossAssetsKrw = input.krwCash + (input.usdCash * (input.usdKrwRate ?? 0))
    for (const settlement of input.pendingSettlements) {
      grossAssetsKrw += convertToKrw(settlement.amount, settlement.currency, input.usdKrwRate) ?? 0
    }
    for (const position of positions) grossAssetsKrw += position.marketValueKrw ?? 0
    unrealizedPnlKrw = positions.reduce((sum, item) => sum + (item.unrealizedPnlKrw ?? 0), 0)
  }

  const liabilitiesKrw = input.loan.principal
    + Math.ceil(input.loan.accruedInterest + input.loan.pastDueInterest + input.loan.overdueCharge)
  const principalRepaidKrw = Math.max(0, INITIAL_LOAN_PRINCIPAL - input.loan.principal)
  const strategyCapitalKrw = grossAssetsKrw === null ? null : grossAssetsKrw + principalRepaidKrw
  const strategyReturnRate = strategyCapitalKrw === null ? null : ((strategyCapitalKrw / INITIAL_KRW_CASH) - 1) * 100
  const netWorthKrw = grossAssetsKrw === null ? null : grossAssetsKrw - liabilitiesKrw
  const realized = sumRealizedPnlKrw(input.trades, input.usdKrwRate)

  return {
    positions,
    grossAssetsKrw,
    liabilitiesKrw,
    netWorthKrw,
    principalRepaidKrw,
    strategyCapitalKrw,
    strategyReturnRate,
    realizedPnlKrw: realized.value,
    realizedPnlIncomplete: realized.incomplete,
    unrealizedPnlKrw,
    cumulativeFeesKrw: sumFeesKrw(input.trades, input.usdKrwRate),
    valuationComplete,
    missingPriceAssetIds,
    needsFxRate,
  }
}
