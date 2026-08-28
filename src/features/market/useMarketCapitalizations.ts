import { useEffect, useMemo, useState } from 'react'
import { marketDataClient } from '../../data/marketDataClient'
import type { MarketSessionStates } from '../../game/trading/types'
import type { AssetManifestItem } from '../../types/market'
import { selectMarketCapitalization, type MarketCapitalizationQuote } from '../../game/market/marketCapitalization'

const LOAD_BATCH_SIZE = 12

interface State {
  quotes: Record<string, MarketCapitalizationQuote | null>
  complete: boolean
}

export function useMarketCapitalizations(
  assets: AssetManifestItem[],
  gameDate: string,
  sessions: MarketSessionStates,
): State {
  const [state, setState] = useState<State>({ quotes: {}, complete: false })
  const assetKey = useMemo(
    () => assets.map((asset) => `${asset.id}:${asset.marketCapPath ?? ''}`).join('|'),
    [assets],
  )
  const sessionKey = `${sessions.KR.phase}:${sessions.KR.tradingDate ?? ''}|${sessions.US.phase}:${sessions.US.tradingDate ?? ''}`

  useEffect(() => {
    let cancelled = false
    const collected: Record<string, MarketCapitalizationQuote | null> = Object.fromEntries(
      assets.map((asset) => [asset.id, null]),
    )
    setState({ quotes: collected, complete: false })

    if (assets.length === 0) {
      setState({ quotes: collected, complete: true })
      return () => { cancelled = true }
    }

    const loadableAssets = assets.filter((asset) => Boolean(asset.marketCapPath))
    if (loadableAssets.length === 0) {
      setState({ quotes: collected, complete: true })
      return () => { cancelled = true }
    }

    const load = async () => {
      for (let start = 0; start < loadableAssets.length; start += LOAD_BATCH_SIZE) {
        const batch = loadableAssets.slice(start, start + LOAD_BATCH_SIZE)
        const entries = await Promise.all(batch.map(async (asset) => {
          try {
            const series = await marketDataClient.loadAssetMarketCapitalizationSeriesAtPath(asset.marketCapPath!)
            return [asset.id, selectMarketCapitalization(series, gameDate, sessions[asset.market])] as const
          } catch {
            return [asset.id, null] as const
          }
        }))
        Object.assign(collected, Object.fromEntries(entries))
        if (cancelled) return
        setState({ quotes: { ...collected }, complete: false })
      }
      if (!cancelled) setState({ quotes: collected, complete: true })
    }

    void load()
    return () => { cancelled = true }
  }, [assetKey, assets, gameDate, sessionKey, sessions])

  return state
}
