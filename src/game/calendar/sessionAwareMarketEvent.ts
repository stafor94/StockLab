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
  const missedOpen = getMarketEventsBetween(lookbackTimestamp, currentTimestamp, calendars)
    .findLast((event) => event.market === nextEvent.market
      && event.type === 'OPEN'
      && event.tradingDate === nextEvent.tradingDate)

  return missedOpen ?? nextEvent
}
