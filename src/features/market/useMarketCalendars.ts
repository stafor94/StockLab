import { useEffect, useState } from 'react'
import { marketDataClient } from '../../data/marketDataClient'
import type { MarketCalendars } from '../../types/market'

export type CalendarLoadStatus = 'loading' | 'ready' | 'error'

interface MarketCalendarState {
  calendars: MarketCalendars | null
  status: CalendarLoadStatus
  error: string | null
}

export function useMarketCalendars(): MarketCalendarState {
  const [state, setState] = useState<MarketCalendarState>({
    calendars: null,
    status: 'loading',
    error: null,
  })

  useEffect(() => {
    let active = true

    Promise.all([
      marketDataClient.loadCalendar('KR'),
      marketDataClient.loadCalendar('US'),
    ])
      .then(([KR, US]) => {
        if (active) {
          setState({ calendars: { KR, US }, status: 'ready', error: null })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            calendars: null,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown calendar load error',
          })
        }
      })

    return () => {
      active = false
    }
  }, [])

  return state
}
