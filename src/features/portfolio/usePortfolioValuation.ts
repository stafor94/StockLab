import { useEffect, useMemo, useState } from 'react'
import { marketDataClient } from '../../data/marketDataClient'
import { buildPortfolioSnapshot, selectKnownValuationPrice } from '../../game/portfolio/portfolioEngine'
import type { KnownValuationPrice } from '../../game/portfolio/types'
import { useGameStore } from '../../stores/gameStore'
import { useFxRate } from '../assets/useFxRate'
import { useMarketCatalog } from '../market/useMarketCatalog'

export function usePortfolioValuation() {
  const game = useGameStore()
  const catalog = useMarketCatalog()
  const fx = useFxRate(game.gameDate)
  const [prices, setPrices] = useState<Record<string, KnownValuationPrice | undefined>>({})
  const [loading, setLoading] = useState(false)

  const positionKey = useMemo(() => game.positions.map((item) => item.assetId).sort().join('|'), [game.positions])
  const sessionKey = `${game.marketSessions.KR.phase}:${game.marketSessions.KR.tradingDate ?? ''}|${game.marketSessions.US.phase}:${game.marketSessions.US.tradingDate ?? ''}`

  useEffect(() => {
    let cancelled = false
    if (game.positions.length === 0) {
      setPrices({})
      setLoading(false)
      return () => { cancelled = true }
    }
    setLoading(true)
    void Promise.all(game.positions.map(async (position) => {
      const asset = catalog.assets.find((item) => item.id === position.assetId)
      if (!asset) return [position.assetId, undefined] as const
      try {
        const series = await marketDataClient.loadAssetPriceSeriesAtPath(asset.dataPath)
        return [position.assetId, selectKnownValuationPrice(series, game.gameDate, game.marketSessions[position.market]) ?? undefined] as const
      } catch {
        return [position.assetId, undefined] as const
      }
    })).then((entries) => {
      if (!cancelled) {
        setPrices(Object.fromEntries(entries))
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [catalog.assets, game.gameDate, game.marketSessions, positionKey, sessionKey])

  const usdKrwRate = fx.ratePoint?.usdKrw ?? null
  const snapshot = useMemo(() => buildPortfolioSnapshot({
    krwCash: game.krwCash,
    usdCash: game.usdCash,
    loan: game.loan,
    positions: game.positions,
    pendingSettlements: game.pendingSettlements,
    trades: game.trades,
    prices,
    usdKrwRate,
  }), [game.krwCash, game.loan, game.pendingSettlements, game.positions, game.trades, game.usdCash, prices, usdKrwRate])

  return { snapshot, assets: catalog.assets, catalogSource: catalog.source, fxStatus: fx.status, loading }
}
