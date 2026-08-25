import { useEffect, useMemo, useState } from 'react'
import { fxDataClient } from '../../data/fxDataClient'
import { findUsdKrwRatePointForDate } from '../../game/exchange/exchangeEngine'
import type { FxRateSeries } from '../../types/fx'

type State =
  | { status: 'loading'; series: null; error: null }
  | { status: 'ready'; series: FxRateSeries; error: null }
  | { status: 'unavailable'; series: null; error: string }

export function useFxRate(gameDate: string) {
  const [state, setState] = useState<State>({ status: 'loading', series: null, error: null })

  useEffect(() => {
    let cancelled = false
    void fxDataClient.loadUsdKrw()
      .then((series) => { if (!cancelled) setState({ status: 'ready', series, error: null }) })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable', series: null, error: '한국은행 환율 데이터 파일이 아직 배포되지 않았습니다.' })
      })
    return () => { cancelled = true }
  }, [])

  const ratePoint = useMemo(
    () => state.status === 'ready' ? findUsdKrwRatePointForDate(state.series, gameDate) : null,
    [gameDate, state],
  )

  return { ...state, ratePoint }
}
