import { marketDataClient } from '../../data/marketDataClient'
import { getSettlementDate } from '../../game/settlement/settlementRules'
import type { MarketOpenExecutionContext, MarketOrder } from '../../game/trading/types'
import type { AssetManifestItem, MarketCalendar, MarketCode } from '../../types/market'

interface BuildMarketOpenContextInput {
  market: MarketCode
  date: string
  orders: MarketOrder[]
  assets: AssetManifestItem[]
  calendars: { KR: MarketCalendar; US: MarketCalendar }
}

export async function buildMarketOpenContext({
  market,
  date,
  orders,
  assets,
  calendars,
}: BuildMarketOpenContextInput): Promise<MarketOpenExecutionContext> {
  const openPrices: Record<string, number | undefined> = {}
  const settlementDates: Record<string, string | undefined> = {}
  const marketOrders = orders.filter((order) => order.market === market && order.tradeDate === date)
  const uniqueAssetIds = [...new Set(marketOrders.map((order) => order.assetId))]

  await Promise.all(uniqueAssetIds.map(async (assetId) => {
    const asset = assets.find((item) => item.id === assetId && item.market === market)
    if (!asset) return
    try {
      const series = await marketDataClient.loadAssetPriceSeriesAtPath(asset.dataPath)
      openPrices[assetId] = series.bars.find((bar) => bar.date === date)?.open
    } catch {
      openPrices[assetId] = undefined
    }
    if (marketOrders.some((order) => order.assetId === assetId && order.kind.startsWith('sell-'))) {
      settlementDates[assetId] = getSettlementDate(asset.market, date, calendars[asset.market]) ?? undefined
    }
  }))

  return { market, date, openPrices, settlementDates }
}
