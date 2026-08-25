import { useEffect, useState } from 'react'
import { marketDataClient } from '../../data/marketDataClient'
import type { AssetManifestItem } from '../../types/market'
import { getFallbackCatalog } from './assetCatalog'

export type MarketCatalogSource = 'loading' | 'manifest' | 'fallback'

interface MarketCatalogState {
  assets: AssetManifestItem[]
  source: MarketCatalogSource
  error: string | null
}

const fallbackAssets = getFallbackCatalog()

export function useMarketCatalog(): MarketCatalogState {
  const [state, setState] = useState<MarketCatalogState>({
    assets: fallbackAssets,
    source: 'loading',
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    void marketDataClient.loadManifest()
      .then((manifest) => {
        if (cancelled) return
        if (manifest.assets.length === 0) {
          setState({ assets: fallbackAssets, source: 'fallback', error: null })
          return
        }
        setState({ assets: manifest.assets, source: 'manifest', error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          assets: fallbackAssets,
          source: 'fallback',
          error: error instanceof Error ? error.message : '시장 카탈로그를 불러오지 못했습니다.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
