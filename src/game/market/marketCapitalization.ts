import type { MarketSessionState } from '../trading/types'
import type { AssetManifestItem, AssetMarketCapitalizationSeries } from '../../types/market'

export type MarketCapitalizationSource = 'previous-close' | 'today-open' | 'today-close'

export interface MarketCapitalizationQuote {
  value: number
  currency: 'KRW' | 'USD'
  valueDate: string
  source: MarketCapitalizationSource
}

function lastBarBefore(series: AssetMarketCapitalizationSeries, date: string) {
  let result: AssetMarketCapitalizationSeries['bars'][number] | undefined
  for (const bar of series.bars) {
    if (bar.date >= date) break
    result = bar
  }
  return result
}

export function selectMarketCapitalization(
  series: AssetMarketCapitalizationSeries,
  gameDate: string,
  session: MarketSessionState,
): MarketCapitalizationQuote | null {
  const referenceDate = session.tradingDate ?? gameDate
  const current = series.bars.find((bar) => bar.date === referenceDate)

  if (session.phase === 'closed' && current?.close !== null && current?.close !== undefined) {
    return { value: current.close, currency: series.currency, valueDate: current.date, source: 'today-close' }
  }
  if (session.phase === 'opened' && current?.open !== null && current?.open !== undefined) {
    return { value: current.open, currency: series.currency, valueDate: current.date, source: 'today-open' }
  }
  if (current?.preopen !== null && current?.preopen !== undefined) {
    return { value: current.preopen, currency: series.currency, valueDate: current.date, source: 'previous-close' }
  }

  const previous = lastBarBefore(series, referenceDate)
  if (!previous || previous.close === null) return null
  return { value: previous.close, currency: series.currency, valueDate: previous.date, source: 'previous-close' }
}

export function rankAssetsByMarketCapitalization(
  assets: AssetManifestItem[],
  quotes: Readonly<Record<string, MarketCapitalizationQuote | null | undefined>>,
  usdKrw: number | null,
): AssetManifestItem[] {
  const originalOrder = new Map(assets.map((asset, index) => [asset.id, index]))
  const currencies = new Set(assets.map((asset) => asset.currency))
  const mixedCurrencies = currencies.size > 1

  const rankValue = (asset: AssetManifestItem): number | null => {
    const quote = quotes[asset.id]
    if (!quote || !Number.isFinite(quote.value) || quote.value <= 0) return null
    if (quote.currency === 'KRW') return quote.value
    if (!mixedCurrencies) return quote.value
    if (usdKrw === null || !Number.isFinite(usdKrw) || usdKrw <= 0) return null
    return quote.value * usdKrw
  }

  return [...assets].sort((left, right) => {
    const leftValue = rankValue(left)
    const rightValue = rankValue(right)
    if (leftValue === null && rightValue !== null) return 1
    if (leftValue !== null && rightValue === null) return -1
    if (leftValue !== null && rightValue !== null && leftValue !== rightValue) return rightValue - leftValue
    return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0)
  })
}
