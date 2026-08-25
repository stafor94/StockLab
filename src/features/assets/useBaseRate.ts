import { useEffect, useMemo, useState } from 'react'
import { rateDataClient } from '../../data/rateDataClient'
import { getBaseRateForDate } from '../../game/loan/rateRules'
import type { BaseRateSeries } from '../../types/rates'

type RateState =
  | { status: 'loading'; series: null; error: null }
  | { status: 'ready'; series: BaseRateSeries; error: null }
  | { status: 'unavailable'; series: null; error: string }

export function useBaseRate(gameDate: string) {
  const [state, setState] = useState<RateState>({ status: 'loading', series: null, error: null })

  useEffect(() => {
    let cancelled = false
    void rateDataClient.loadBaseRates()
      .then((series) => { if (!cancelled) setState({ status: 'ready', series, error: null }) })
      .catch((error: unknown) => {
        if (!cancelled) setState({
          status: 'unavailable',
          series: null,
          error: error instanceof Error ? error.message : '한국은행 기준금리를 불러오지 못했습니다.',
        })
      })
    return () => { cancelled = true }
  }, [])

  const baseRate = useMemo(() => {
    if (state.status !== 'ready') return null
    try { return getBaseRateForDate(state.series, gameDate) } catch { return null }
  }, [gameDate, state])

  return { ...state, baseRate }
}
