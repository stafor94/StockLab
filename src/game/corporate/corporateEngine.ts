import type { AssetCurrency } from '../../types/market'
import type { Position, TradeExecution } from '../trading/types'
import type {
  AssetRestriction,
  CorporateActionProcessResult,
  CorporateActionRecord,
  CorporateActionState,
  CorporateEvent,
  CorporateEventType,
} from './types'

function cloneState(source: CorporateActionState): CorporateActionState {
  return {
    ...source,
    positions: source.positions.map((item) => ({ ...item })),
    pendingOrders: source.pendingOrders.map((item) => ({ ...item })),
    trades: source.trades.map((item) => ({ ...item })),
    assetRestrictions: Object.fromEntries(Object.entries(source.assetRestrictions).map(([key, value]) => [key, { ...value }])),
    corporateHistory: source.corporateHistory.map((item) => ({ ...item })),
    pendingImportantEvents: source.pendingImportantEvents.map((item) => ({ ...item })),
  }
}

function setCash(state: CorporateActionState, currency: AssetCurrency, delta: number): void {
  if (currency === 'KRW') state.krwCash += delta
  else state.usdCash += delta
}

function positionFor(state: CorporateActionState, assetId: string): Position | undefined {
  return state.positions.find((position) => position.assetId === assetId)
}

function restrictionFor(state: CorporateActionState, assetId: string): AssetRestriction {
  return state.assetRestrictions[assetId] ?? { halted: false, delisted: false }
}

function setRestriction(state: CorporateActionState, assetId: string, patch: Partial<AssetRestriction>): void {
  state.assetRestrictions[assetId] = { ...restrictionFor(state, assetId), ...patch }
}

function cancelOrders(state: CorporateActionState, assetId: string): void {
  state.pendingOrders = state.pendingOrders.filter((order) => order.assetId !== assetId)
}

function eventRevealDate(event: CorporateEvent, gameDates: string[]): string | null {
  if (event.timing === 'PRE_OPEN') return event.date
  return gameDates.find((date) => date > event.date) ?? null
}

function defaultImportant(type: CorporateEventType): boolean {
  return type !== 'DIVIDEND'
}

export function isImportantCorporateEvent(event: CorporateEvent): boolean {
  return event.important ?? defaultImportant(event.type)
}

export function findFirstImportantCorporateStopDate(
  fromDate: string,
  requestedDate: string,
  events: CorporateEvent[],
  processedEventIds: Set<string>,
  gameDates: string[],
): string | null {
  const candidates = events
    .filter((event) => !processedEventIds.has(event.id) && isImportantCorporateEvent(event))
    .map((event) => eventRevealDate(event, gameDates))
    .filter((date): date is string => Boolean(date && date > fromDate && date <= requestedDate))
    .sort()
  return candidates[0] ?? null
}

function createRecord(event: CorporateEvent, note: string, cashDelta: number, quantityBefore: number | null, quantityAfter: number | null): CorporateActionRecord {
  return {
    eventId: event.id,
    assetId: event.assetId,
    date: event.date,
    type: event.type,
    timing: event.timing,
    title: event.title,
    summary: event.summary,
    note,
    cashDelta,
    quantityBefore,
    quantityAfter,
  }
}

type EntitlementTimelineItem =
  | { kind: 'event'; date: string; event: CorporateEvent }
  | { kind: 'trade'; date: string; trade: TradeExecution }

function quantityFor(quantities: Map<string, number>, assetId: string): number {
  return quantities.get(assetId) ?? 0
}

function setQuantity(quantities: Map<string, number>, assetId: string, quantity: number): void {
  if (quantity <= 1e-9) quantities.delete(assetId)
  else quantities.set(assetId, quantity)
}

function applyEntitlementEvent(quantities: Map<string, number>, event: CorporateEvent): void {
  const sourceQuantity = quantityFor(quantities, event.assetId)
  if (sourceQuantity <= 0) return
  if (event.type === 'SPLIT' || event.type === 'REVERSE_SPLIT') {
    const exactQuantity = sourceQuantity * event.payload.numerator / event.payload.denominator
    setQuantity(quantities, event.assetId, Math.floor(exactQuantity + 1e-10))
    return
  }
  if (event.type === 'MERGER') {
    setQuantity(quantities, event.assetId, 0)
    if (!event.payload.targetAssetId || !event.payload.shareNumerator || !event.payload.shareDenominator) return
    const converted = Math.floor(sourceQuantity * event.payload.shareNumerator / event.payload.shareDenominator + 1e-10)
    setQuantity(quantities, event.payload.targetAssetId, quantityFor(quantities, event.payload.targetAssetId) + converted)
    return
  }
  if (event.type === 'DELISTING' && event.payload.cashOutPerShare !== undefined) setQuantity(quantities, event.assetId, 0)
}

function dividendEntitlementQuantity(
  state: CorporateActionState,
  event: Extract<CorporateEvent, { type: 'DIVIDEND' }>,
  events: CorporateEvent[],
  gameDates: string[],
): number {
  const timeline: EntitlementTimelineItem[] = []
  for (const historicalEvent of events) {
    if (historicalEvent.type !== 'SPLIT' && historicalEvent.type !== 'REVERSE_SPLIT' && historicalEvent.type !== 'MERGER' && historicalEvent.type !== 'DELISTING') continue
    const revealDate = eventRevealDate(historicalEvent, gameDates)
    if (revealDate && revealDate < event.payload.exDate) timeline.push({ kind: 'event', date: revealDate, event: historicalEvent })
  }
  for (const trade of state.trades) {
    if (trade.executedDate < event.payload.exDate) timeline.push({ kind: 'trade', date: trade.executedDate, trade })
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date)
    || (a.kind === b.kind ? (a.kind === 'event' ? a.event.id.localeCompare((b as Extract<EntitlementTimelineItem, { kind: 'event' }>).event.id) : a.trade.orderId.localeCompare((b as Extract<EntitlementTimelineItem, { kind: 'trade' }>).trade.orderId)) : a.kind === 'event' ? -1 : 1))

  const quantities = new Map<string, number>()
  for (const item of timeline) {
    if (item.kind === 'event') {
      applyEntitlementEvent(quantities, item.event)
      continue
    }
    const before = quantityFor(quantities, item.trade.assetId)
    const after = item.trade.side === 'buy' ? before + item.trade.quantity : before - item.trade.quantity
    if (after < -1e-8) throw new Error(`Trade history cannot reconstruct dividend entitlement for ${event.id}`)
    setQuantity(quantities, item.trade.assetId, Math.max(0, after))
  }
  return quantityFor(quantities, event.assetId)
}

function applyDividend(
  state: CorporateActionState,
  event: Extract<CorporateEvent, { type: 'DIVIDEND' }>,
  events: CorporateEvent[],
  gameDates: string[],
): CorporateActionRecord {
  const eligibleQuantity = dividendEntitlementQuantity(state, event, events, gameDates)
  if (eligibleQuantity <= 0) return createRecord(event, `배당락일(${event.payload.exDate}) 기준 권리수량이 없어 현금 변동이 없습니다.`, 0, 0, 0)
  const gross = eligibleQuantity * event.payload.cashPerShare
  const net = gross * (1 - event.payload.withholdingRate)
  setCash(state, event.payload.currency, net)
  return createRecord(
    event,
    `배당락일(${event.payload.exDate}) 기준 ${eligibleQuantity}주 · 세후 배당금 ${net.toFixed(event.payload.currency === 'KRW' ? 0 : 2)} ${event.payload.currency} 입금`,
    net,
    eligibleQuantity,
    eligibleQuantity,
  )
}

function applySplit(state: CorporateActionState, event: Extract<CorporateEvent, { type: 'SPLIT' | 'REVERSE_SPLIT' }>): CorporateActionRecord {
  const position = positionFor(state, event.assetId)
  if (!position || position.quantity <= 0) return createRecord(event, '보유 수량이 없어 분할/병합에 따른 계좌 변동이 없습니다.', 0, null, null)
  const before = position.quantity
  const exactQuantity = before * event.payload.numerator / event.payload.denominator
  const wholeQuantity = Math.floor(exactQuantity + 1e-10)
  const fraction = exactQuantity - wholeQuantity
  let cashDelta = 0
  if (fraction > 1e-9) {
    if (event.payload.cashInLieuPrice === undefined) throw new Error(`Fractional split entitlement requires cashInLieuPrice: ${event.id}`)
    cashDelta = fraction * event.payload.cashInLieuPrice
    setCash(state, position.currency, cashDelta)
  }
  position.quantity = wholeQuantity
  position.averagePrice = position.averagePrice * event.payload.denominator / event.payload.numerator
  if (wholeQuantity <= 0) state.positions = state.positions.filter((item) => item.assetId !== event.assetId)
  return createRecord(event, `보유수량 ${before}주 → ${wholeQuantity}주${cashDelta > 0 ? ' · 단주대금 별도 입금' : ''}`, cashDelta, before, wholeQuantity)
}

function mergeIntoTarget(state: CorporateActionState, source: Position, event: Extract<CorporateEvent, { type: 'MERGER' }>): { quantityAfter: number; cashDelta: number } {
  const payload = event.payload
  let cashDelta = (payload.cashPerShare ?? 0) * source.quantity
  if (cashDelta > 0) setCash(state, source.currency, cashDelta)
  if (!payload.targetAssetId) return { quantityAfter: 0, cashDelta }
  if (!payload.targetMarket || !payload.targetCurrency || !payload.shareNumerator || !payload.shareDenominator) {
    throw new Error(`Share merger target metadata is incomplete: ${event.id}`)
  }
  const exactQuantity = source.quantity * payload.shareNumerator / payload.shareDenominator
  const wholeQuantity = Math.floor(exactQuantity + 1e-10)
  const fraction = exactQuantity - wholeQuantity
  if (fraction > 1e-9) {
    if (payload.cashInLieuPrice === undefined) throw new Error(`Fractional merger entitlement requires cashInLieuPrice: ${event.id}`)
    const fractionCash = fraction * payload.cashInLieuPrice
    setCash(state, payload.targetCurrency, fractionCash)
    cashDelta += fractionCash
  }
  if (wholeQuantity > 0) {
    const oldBookValue = source.averagePrice * source.quantity
    const existing = positionFor(state, payload.targetAssetId)
    if (existing) {
      const newTotal = existing.quantity + wholeQuantity
      existing.averagePrice = ((existing.averagePrice * existing.quantity) + oldBookValue) / newTotal
      existing.quantity = newTotal
    } else {
      state.positions.push({ assetId: payload.targetAssetId, market: payload.targetMarket, currency: payload.targetCurrency, quantity: wholeQuantity, averagePrice: oldBookValue / wholeQuantity })
    }
  }
  return { quantityAfter: wholeQuantity, cashDelta }
}

function applyEvent(state: CorporateActionState, event: CorporateEvent, events: CorporateEvent[], gameDates: string[]): CorporateActionRecord {
  if (event.type === 'DIVIDEND') return applyDividend(state, event, events, gameDates)
  if (event.type === 'SPLIT' || event.type === 'REVERSE_SPLIT') return applySplit(state, event)

  const position = positionFor(state, event.assetId)
  const before = position?.quantity ?? null
  if (event.type === 'HALT') {
    setRestriction(state, event.assetId, { halted: true })
    cancelOrders(state, event.assetId)
    return createRecord(event, '거래정지 적용 · 해당 종목의 미체결 주문 취소', 0, before, before)
  }
  if (event.type === 'RESUME') {
    setRestriction(state, event.assetId, { halted: false })
    return createRecord(event, '거래정지 해제', 0, before, before)
  }
  if (event.type === 'LISTING') {
    setRestriction(state, event.assetId, { halted: false, delisted: false })
    return createRecord(event, '상장 상태 적용', 0, before, before)
  }
  if (event.type === 'DELISTING') {
    setRestriction(state, event.assetId, { delisted: true, halted: false })
    cancelOrders(state, event.assetId)
    let cashDelta = 0
    if (position && event.payload.cashOutPerShare !== undefined) {
      cashDelta = position.quantity * event.payload.cashOutPerShare
      setCash(state, position.currency, cashDelta)
      state.positions = state.positions.filter((item) => item.assetId !== event.assetId)
    }
    return createRecord(event, cashDelta > 0 ? '상장폐지 및 현금정산 완료' : '상장폐지 적용 · 보유분은 자동 소각하지 않음', cashDelta, before, cashDelta > 0 ? 0 : before)
  }
  if (event.type === 'MERGER') {
    cancelOrders(state, event.assetId)
    setRestriction(state, event.assetId, { delisted: true, halted: false })
    if (!position) return createRecord(event, '합병 효력 발생 · 보유 수량 없음', 0, null, null)
    const outcome = mergeIntoTarget(state, position, event)
    state.positions = state.positions.filter((item) => item.assetId !== event.assetId)
    return createRecord(event, '합병 교환/현금대가를 계좌에 반영', outcome.cashDelta, before, outcome.quantityAfter)
  }
  throw new Error(`Unsupported corporate event: ${(event as CorporateEvent).type}`)
}

export function processCorporateEventsToDate(
  source: CorporateActionState,
  fromDate: string,
  toDate: string,
  events: CorporateEvent[],
  gameDates: string[],
): CorporateActionProcessResult {
  const state = cloneState(source)
  const processed = new Set(state.corporateHistory.map((record) => record.eventId))
  const due = events
    .map((event) => ({ event, revealDate: eventRevealDate(event, gameDates) }))
    .filter((item): item is { event: CorporateEvent; revealDate: string } => Boolean(item.revealDate))
    .filter(({ event, revealDate }) => !processed.has(event.id) && revealDate > fromDate && revealDate <= toDate)
    .sort((a, b) => a.revealDate.localeCompare(b.revealDate) || a.event.id.localeCompare(b.event.id))

  const records: CorporateActionRecord[] = []
  for (const { event } of due) {
    const record = applyEvent(state, event, events, gameDates)
    state.corporateHistory.push(record)
    records.push(record)
    if (isImportantCorporateEvent(event)) state.pendingImportantEvents.push(record)
  }
  return { state, records }
}
