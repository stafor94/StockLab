import type { MarketCalendars } from '../../types/market'
import type { MarketSessionStates } from '../trading/types'
import { getMarketEventsBetween, getNextMarketEvent, type MarketEvent } from './marketTimeline'

const RECOVERY_LOOKBACK_MS = 24 * 60 * 60 * 1000

export function getNextSessionAwareMarketEvent(
  currentTimestamp: string,
  calendars: MarketCalendars,
  sessions: MarketSessionStates,
): MarketEvent | null {
  const nextEvent = getNextMarketEvent(currentTimestamp, calendars)
  if (!nextEvent || nextEvent.type !== 'CLOSE') return nextEvent

  const session = sessions[nextEvent.market]
  if (session.phase === 'opened' && session.tradingDate === nextEvent.tradingDate) return nextEvent

  const currentMs = Date.parse(currentTimestamp)
  if (!Number.isFinite(currentMs)) throw new Error('Invalid game timestamp')

  const lookbackTimestamp = new Date(currentMs - RECOVERY_LOOKBACK_MS).toISOString()
  const recentEvents = getMarketEventsBetween(lookbackTimestamp, currentTimestamp, calendars)
  for (let index = recentEvents.length - 1; index >= 0; index -= 1) {
    const event = recentEvents[index]
    if (event.market === nextEvent.market && event.type === 'OPEN' && event.tradingDate === nextEvent.tradingDate) {
      return event
    }
  }

  return nextEvent
}
