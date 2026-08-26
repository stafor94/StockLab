import { useEffect, useState } from 'react'
import { marketIndexDataClient } from '../../data/marketIndexDataClient'
import type { MarketIndexSeries } from '../../types/marketIndex'

export type MarketIndexLoadStatus = 'loading' | 'ready' | 'error'

interface MarketIndexState {
  series: MarketIndexSeries[]
  status: MarketIndexLoadStatus
  error: string | null
}

export function useMarketIndices(): MarketIndexState {
  const [state, setState] = useState<MarketIndexState>({ series: [], status: 'loading', error: null })

  useEffect(() => {
    let active = true
    void marketIndexDataClient.loadAllSeries()
      .then((series) => {
        if (active) setState({ series, status: 'ready', error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          series: [],
          status: 'error',
          error: error instanceof Error ? error.message : '주요 지수 데이터를 불러오지 못했습니다.',
        })
      })

    return () => {
      active = false
    }
  }, [])

  return state
}
