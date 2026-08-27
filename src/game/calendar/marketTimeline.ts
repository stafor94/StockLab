import type { MarketCalendar, MarketCalendars, MarketCode } from '../../types/market'
import type { MarketSessionPhase, MarketSessionStates } from '../trading/types'

export type MarketEventType = 'OPEN' | 'CLOSE'

export interface MarketEvent {
  market: MarketCode
  type: MarketEventType
  tradingDate: string
  timestamp: string
  displayTimestamp: string
}

export type GameTimeStep = 'day' | 'week' | 'month'

const KST_TIME_ZONE = 'Asia/Seoul'
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const MARKET_LOCAL_TIMES: Record<MarketCode, Record<MarketEventType, { hour: number; minute: number }>> = {
  KR: {
    OPEN: { hour: 9, minute: 0 },
    CLOSE: { hour: 15, minute: 30 },
  },
  US: {
    OPEN: { hour: 9, minute: 30 },
    CLOSE: { hour: 16, minute: 0 },
  },
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  formatterCache.set(timeZone, formatter)
  return formatter
}

function partsInZone(timestampMs: number, timeZone: string) {
  const parts = dateTimeFormatter(timeZone).formatToParts(new Date(timestampMs))
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function zonedLocalDateTimeToIso(date: string, hour: number, minute: number, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const targetWallClockMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  let candidateMs = targetWallClockMs

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = partsInZone(candidateMs, timeZone)
    const currentWallClockMs = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
    )
    const correction = targetWallClockMs - currentWallClockMs
    candidateMs += correction
    if (correction === 0) break
  }

  return new Date(candidateMs).toISOString()
}

function buildMarketEvent(calendar: MarketCalendar, tradingDate: string, type: MarketEventType): MarketEvent {
  const localTime = MARKET_LOCAL_TIMES[calendar.market][type]
  const timestamp = zonedLocalDateTimeToIso(tradingDate, localTime.hour, localTime.minute, calendar.timeZone)
  return {
    market: calendar.market,
    type,
    tradingDate,
    timestamp,
    displayTimestamp: type === 'CLOSE'
      ? new Date(Date.parse(timestamp) - 60_000).toISOString()
      : timestamp,
  }
}

function compareEvents(left: MarketEvent, right: MarketEvent): number {
  const timestampDifference = Date.parse(left.timestamp) - Date.parse(right.timestamp)
  if (timestampDifference !== 0) return timestampDifference
  if (left.market !== right.market) return left.market.localeCompare(right.market)
  return left.type.localeCompare(right.type)
}

export function getMarketEventsBetween(
  currentTimestamp: string,
  targetTimestamp: string,
  calendars: MarketCalendars,
): MarketEvent[] {
  const currentMs = Date.parse(currentTimestamp)
  const targetMs = Date.parse(targetTimestamp)
  if (!Number.isFinite(currentMs) || !Number.isFinite(targetMs)) throw new Error('Invalid game timestamp')
  if (targetMs <= currentMs) return []

  const events: MarketEvent[] = []
  for (const calendar of [calendars.KR, calendars.US]) {
    for (const tradingDate of calendar.tradingDates) {
      const openEvent = buildMarketEvent(calendar, tradingDate, 'OPEN')
      const openMs = Date.parse(openEvent.timestamp)
      if (openMs > currentMs && openMs <= targetMs) events.push(openEvent)

      const closeEvent = buildMarketEvent(calendar, tradingDate, 'CLOSE')
      const closeMs = Date.parse(closeEvent.timestamp)
      if (closeMs > currentMs && closeMs <= targetMs) events.push(closeEvent)
    }
  }
  return events.sort(compareEvents)
}

export function getNextMarketEvent(currentTimestamp: string, calendars: MarketCalendars): MarketEvent | null {
  const currentMs = Date.parse(currentTimestamp)
  if (!Number.isFinite(currentMs)) throw new Error('Invalid game timestamp')

  let nextEvent: MarketEvent | null = null
  for (const calendar of [calendars.KR, calendars.US]) {
    for (const tradingDate of calendar.tradingDates) {
      for (const type of ['OPEN', 'CLOSE'] as const) {
        const event = buildMarketEvent(calendar, tradingDate, type)
        if (Date.parse(event.timestamp) <= currentMs) continue
        if (!nextEvent || compareEvents(event, nextEvent) < 0) nextEvent = event
        break
      }
      if (nextEvent && Date.parse(buildMarketEvent(calendar, tradingDate, 'OPEN').timestamp) > Date.parse(nextEvent.timestamp)) break
    }
  }
  return nextEvent
}

export function createInitialMarketSessions(): MarketSessionStates {
  return {
    KR: { phase: 'preopen', tradingDate: null },
    US: { phase: 'preopen', tradingDate: null },
  }
}

export function applyMarketEventToSessions(source: MarketSessionStates, event: MarketEvent): MarketSessionStates {
  return {
    KR: { ...source.KR },
    US: { ...source.US },
    [event.market]: {
      phase: event.type === 'OPEN' ? 'opened' : 'closed',
      tradingDate: event.tradingDate,
    },
  }
}

export function applyMarketEventsToSessions(source: MarketSessionStates, events: readonly MarketEvent[]): MarketSessionStates {
  return events.reduce(applyMarketEventToSessions, source)
}

export function getKstGameDate(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid game timestamp')
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

export function getKstGameTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid game timestamp')
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function formatKstGameDate(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid game timestamp')
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date)
}

export function formatMarketEventLabel(event: MarketEvent): string {
  const market = event.market === 'KR' ? '국내장' : '미국장'
  return `${market} ${event.type === 'OPEN' ? '시작' : '마감'}`
}

function kstParts(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid game timestamp')
  return partsInZone(date.getTime(), KST_TIME_ZONE)
}

function kstLocalDateTimeToIso(year: number, month: number, day: number, hour: number, minute: number, second: number): string {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - KST_OFFSET_MS).toISOString()
}

export function advanceGameTimestamp(currentTimestamp: string, step: GameTimeStep): string {
  const current = kstParts(currentTimestamp)
  if (step === 'day' || step === 'week') {
    const days = step === 'day' ? 1 : 7
    const shifted = new Date(Date.UTC(current.year, current.month - 1, current.day + days))
    return kstLocalDateTimeToIso(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
      current.hour,
      current.minute,
      current.second,
    )
  }

  const targetMonth = new Date(Date.UTC(current.year, current.month, 1))
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate()
  return kstLocalDateTimeToIso(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth() + 1,
    Math.min(current.day, lastDay),
    current.hour,
    current.minute,
    current.second,
  )
}

export function marketPhaseForTradingDate(
  sessions: MarketSessionStates,
  market: MarketCode,
  tradingDate: string,
): MarketSessionPhase {
  const session = sessions[market]
  return session.tradingDate === tradingDate ? session.phase : 'preopen'
}
