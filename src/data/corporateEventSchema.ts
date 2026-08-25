import type { AssetCurrency, MarketCode } from '../types/market'
import type {
  CorporateEvent,
  CorporateEventDataset,
  CorporateEventTiming,
  CorporateEventType,
} from '../game/corporate/types'

class CorporateEventSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CorporateEventSchemaError'
  }
}

type JsonRecord = Record<string, unknown>

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new CorporateEventSchemaError(`${label} must be an object`)
  return value as JsonRecord
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new CorporateEventSchemaError(`${label} must be a non-empty string`)
  return value
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new CorporateEventSchemaError(`${label} must be a finite number`)
  return value
}

function optionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined
  return numberValue(value, label)
}

function marketCode(value: unknown, label: string): MarketCode {
  if (value !== 'KR' && value !== 'US') throw new CorporateEventSchemaError(`${label} must be KR or US`)
  return value
}

function currency(value: unknown, label: string): AssetCurrency {
  if (value !== 'KRW' && value !== 'USD') throw new CorporateEventSchemaError(`${label} must be KRW or USD`)
  return value
}

function eventType(value: unknown, label: string): CorporateEventType {
  const allowed: CorporateEventType[] = ['DIVIDEND', 'SPLIT', 'REVERSE_SPLIT', 'MERGER', 'DELISTING', 'LISTING', 'HALT', 'RESUME']
  if (!allowed.includes(value as CorporateEventType)) throw new CorporateEventSchemaError(`${label} has an unsupported event type`)
  return value as CorporateEventType
}

function timing(value: unknown, label: string): CorporateEventTiming {
  if (value !== 'PRE_OPEN' && value !== 'INTRADAY' && value !== 'POST_CLOSE') throw new CorporateEventSchemaError(`${label} has an unsupported timing`)
  return value
}

function defaultImportant(type: CorporateEventType): boolean {
  return type !== 'DIVIDEND'
}

function parseEvent(value: unknown, index: number): CorporateEvent {
  const item = record(value, `events[${index}]`)
  const type = eventType(item.type, `events[${index}].type`)
  const source = record(item.source, `events[${index}].source`)
  const payload = record(item.payload ?? {}, `events[${index}].payload`)
  const base = {
    id: stringValue(item.id, `events[${index}].id`),
    assetId: stringValue(item.assetId, `events[${index}].assetId`),
    date: stringValue(item.date, `events[${index}].date`),
    timing: timing(item.timing, `events[${index}].timing`),
    type,
    title: stringValue(item.title, `events[${index}].title`),
    summary: stringValue(item.summary, `events[${index}].summary`),
    important: typeof item.important === 'boolean' ? item.important : defaultImportant(type),
    source: {
      provider: stringValue(source.provider, `events[${index}].source.provider`),
      reference: stringValue(source.reference, `events[${index}].source.reference`),
    },
  }

  if (type === 'DIVIDEND') {
    const withholdingRate = numberValue(payload.withholdingRate, `events[${index}].payload.withholdingRate`)
    if (withholdingRate < 0 || withholdingRate > 1) throw new CorporateEventSchemaError(`events[${index}].payload.withholdingRate must be between 0 and 1`)
    return { ...base, type, payload: { cashPerShare: numberValue(payload.cashPerShare, `events[${index}].payload.cashPerShare`), currency: currency(payload.currency, `events[${index}].payload.currency`), withholdingRate } }
  }
  if (type === 'SPLIT' || type === 'REVERSE_SPLIT') {
    const numerator = numberValue(payload.numerator, `events[${index}].payload.numerator`)
    const denominator = numberValue(payload.denominator, `events[${index}].payload.denominator`)
    if (numerator <= 0 || denominator <= 0) throw new CorporateEventSchemaError(`events[${index}] split ratio must be positive`)
    return { ...base, type, payload: { numerator, denominator, cashInLieuPrice: optionalNumber(payload.cashInLieuPrice, `events[${index}].payload.cashInLieuPrice`) } }
  }
  if (type === 'MERGER') {
    return {
      ...base,
      type,
      payload: {
        targetAssetId: typeof payload.targetAssetId === 'string' ? payload.targetAssetId : undefined,
        targetMarket: payload.targetMarket === undefined ? undefined : marketCode(payload.targetMarket, `events[${index}].payload.targetMarket`),
        targetCurrency: payload.targetCurrency === undefined ? undefined : currency(payload.targetCurrency, `events[${index}].payload.targetCurrency`),
        shareNumerator: optionalNumber(payload.shareNumerator, `events[${index}].payload.shareNumerator`),
        shareDenominator: optionalNumber(payload.shareDenominator, `events[${index}].payload.shareDenominator`),
        cashPerShare: optionalNumber(payload.cashPerShare, `events[${index}].payload.cashPerShare`),
        cashInLieuPrice: optionalNumber(payload.cashInLieuPrice, `events[${index}].payload.cashInLieuPrice`),
      },
    }
  }
  if (type === 'DELISTING') return { ...base, type, payload: { cashOutPerShare: optionalNumber(payload.cashOutPerShare, `events[${index}].payload.cashOutPerShare`) } }
  return { ...base, type, payload: {} }
}

export function parseCorporateEventDataset(value: unknown): CorporateEventDataset {
  const data = record(value, 'corporate event dataset')
  const coverage = record(data.coverage, 'coverage')
  const source = record(data.source, 'source')
  if (source.mode !== 'empty-seed' && source.mode !== 'generated') throw new CorporateEventSchemaError('source.mode must be empty-seed or generated')
  if (source.generatedAt !== null && typeof source.generatedAt !== 'string') throw new CorporateEventSchemaError('source.generatedAt must be a string or null')
  if (!Array.isArray(data.events)) throw new CorporateEventSchemaError('events must be an array')
  const events = data.events.map(parseEvent)
  const ids = new Set<string>()
  for (const event of events) {
    if (ids.has(event.id)) throw new CorporateEventSchemaError(`duplicate corporate event id: ${event.id}`)
    ids.add(event.id)
  }
  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    coverage: { from: stringValue(coverage.from, 'coverage.from'), to: stringValue(coverage.to, 'coverage.to') },
    source: { mode: source.mode, generatedAt: source.generatedAt },
    events: [...events].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
  }
}
