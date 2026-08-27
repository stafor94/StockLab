import type { DailyBar, MarketCode } from '../types/market'
import type {
  MarketIndexManifest,
  MarketIndexManifestItem,
  MarketIndexSeries,
  MarketIndexSource,
} from '../types/marketIndex'

type JsonRecord = Record<string, unknown>

export class MarketIndexSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarketIndexSchemaError'
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MarketIndexSchemaError(`${label} must be an object`)
  }
  return value as JsonRecord
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new MarketIndexSchemaError(`${label} must be a non-empty string`)
  }
  return value
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MarketIndexSchemaError(`${label} must be a finite number`)
  }
  return value
}

function nullableNumberValue(value: unknown, label: string): number | null {
  if (value === null) return null
  return numberValue(value, label)
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new MarketIndexSchemaError(`${label} must be an array`)
  return value
}

function marketCode(value: unknown, label: string): MarketCode {
  if (value !== 'KR' && value !== 'US') throw new MarketIndexSchemaError(`${label} must be KR or US`)
  return value
}

function parseManifestItem(value: unknown, index: number): MarketIndexManifestItem {
  const item = record(value, `indices[${index}]`)
  return {
    id: stringValue(item.id, `indices[${index}].id`),
    alias: stringValue(item.alias, `indices[${index}].alias`),
    market: marketCode(item.market, `indices[${index}].market`),
    dataPath: stringValue(item.dataPath, `indices[${index}].dataPath`),
  }
}

export function parseMarketIndexManifest(value: unknown): MarketIndexManifest {
  const data = record(value, 'market index manifest')
  const indices = arrayValue(data.indices, 'indices').map(parseManifestItem)
  const ids = new Set<string>()
  for (const index of indices) {
    if (ids.has(index.id)) throw new MarketIndexSchemaError(`duplicate market index id: ${index.id}`)
    ids.add(index.id)
  }
  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    indices,
  }
}

function parseSource(value: unknown): MarketIndexSource {
  const source = record(value, 'source')
  return {
    authoritativeProvider: stringValue(source.authoritativeProvider, 'source.authoritativeProvider'),
    generatedAt: stringValue(source.generatedAt, 'source.generatedAt'),
    reference: stringValue(source.reference, 'source.reference'),
  }
}

function parseDailyBar(value: unknown, index: number): DailyBar {
  const item = record(value, `bars[${index}]`)
  const bar = {
    date: stringValue(item.date, `bars[${index}].date`),
    open: numberValue(item.open, `bars[${index}].open`),
    high: numberValue(item.high, `bars[${index}].high`),
    low: numberValue(item.low, `bars[${index}].low`),
    close: numberValue(item.close, `bars[${index}].close`),
    volume: nullableNumberValue(item.volume, `bars[${index}].volume`),
  }
  if (![bar.open, bar.high, bar.low, bar.close].every((price) => price > 0)) {
    throw new MarketIndexSchemaError(`bars[${index}] OHLC values must be positive`)
  }
  if (bar.volume !== null && bar.volume < 0) {
    throw new MarketIndexSchemaError(`bars[${index}].volume must be non-negative or null`)
  }
  return bar
}

export function parseMarketIndexSeries(value: unknown): MarketIndexSeries {
  const data = record(value, 'market index series')
  const bars = arrayValue(data.bars, 'bars').map(parseDailyBar)
  for (let index = 1; index < bars.length; index += 1) {
    if (bars[index - 1].date >= bars[index].date) {
      throw new MarketIndexSchemaError('market index bars must be unique and ordered by date')
    }
  }
  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    id: stringValue(data.id, 'id'),
    alias: stringValue(data.alias, 'alias'),
    market: marketCode(data.market, 'market'),
    source: parseSource(data.source),
    bars,
  }
}
