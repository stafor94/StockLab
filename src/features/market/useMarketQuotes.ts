import { useEffect, useMemo, useState } from 'react'
import { marketDataClient } from '../../data/marketDataClient'
import type { MarketSessionPhase } from '../../game/trading/types'
import type { AssetManifestItem } from '../../types/market'
import { selectMarketQuote, type MarketQuote } from './marketQuote'

const QUOTE_LOAD_BATCH_SIZE = 12

export function useMarketQuotes(assets: AssetManifestItem[], gameDate: string, phase: MarketSessionPhase) {
  const [quotes, setQuotes] = useState<Record<string, MarketQuote | null>>({})
  const assetKey = useMemo(() => assets.map((asset) => `${asset.id}:${asset.dataPath}`).join('|'), [assets])

  useEffect(() => {
    let cancelled = false
    setQuotes({})

    const load = async () => {
      for (let start = 0; start < assets.length; start += QUOTE_LOAD_BATCH_SIZE) {
        const batch = assets.slice(start, start + QUOTE_LOAD_BATCH_SIZE)
        const entries = await Promise.all(batch.map(async (asset) => {
          try {
            const series = await marketDataClient.loadAssetPriceSeriesAtPath(asset.dataPath)
            return [asset.id, selectMarketQuote(series, gameDate, phase)] as const
          } catch {
            return [asset.id, null] as const
          }
        }))

        if (cancelled) return
        setQuotes((current) => ({ ...current, ...Object.fromEntries(entries) }))
      }
    }

    void load()
    return () => { cancelled = true }
  }, [assetKey, assets, gameDate, phase])

  return quotes
}
