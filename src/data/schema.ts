import type {
  AssetKind,
  AssetManifestItem,
  AssetPriceSeries,
  AssetPriceSource,
  AssetCurrency,
  CalendarClosure,
  CalendarSource,
  DailyBar,
  MarketCalendar,
  MarketCode,
  MarketDataManifest,
} from '../types/market'

type JsonRecord = Record<string, unknown>

export class DataSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataSchemaError'
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataSchemaError(`${label} must be an object`)
  }
  return value as JsonRecord
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DataSchemaError(`${label} must be a non-empty string`)
  }
  return value
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DataSchemaError(`${label} must be a finite number`)
  }
  return value
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DataSchemaError(`${label} must be an array`)
  }
  return value
}

function marketCode(value: unknown, label: string): MarketCode {
  if (value !== 'KR' && value !== 'US') {
    throw new DataSchemaError(`${label} must be KR or US`)
  }
  return value
}

function assetKind(value: unknown, label: string): AssetKind {
  if (value !== 'stock' && value !== 'etf') {
    throw new DataSchemaError(`${label} must be stock or etf`)
  }
  return value
}

function currency(value: unknown, label: string): AssetCurrency {
  if (value !== 'KRW' && value !== 'USD') {
    throw new DataSchemaError(`${label} must be KRW or USD`)
  }
  return value
}

function parseClosure(value: unknown, index: number): CalendarClosure {
  const item = record(value, `closures[${index}]`)
  return {
    date: stringValue(item.date, `closures[${index}].date`),
    reason: stringValue(item.reason, `closures[${index}].reason`),
  }
}

function parseSource(value: unknown): CalendarSource {
  const item = record(value, 'source')
  const mode = item.mode
  if (mode !== 'bootstrap-seed' && mode !== 'generated') {
    throw new DataSchemaError('source.mode must be bootstrap-seed or generated')
  }
  if (item.generatedAt !== null && typeof item.generatedAt !== 'string') {
    throw new DataSchemaError('source.generatedAt must be a string or null')
  }
  return {
    authoritativeProvider: stringValue(item.authoritativeProvider, 'source.authoritativeProvider'),
    mode,
    generatedAt: item.generatedAt,
  }
}

export function parseMarketCalendar(value: unknown): MarketCalendar {
  const data = record(value, 'calendar')
  const coverage = record(data.coverage, 'coverage')
  const tradingDates = arrayValue(data.tradingDates, 'tradingDates').map((item, index) =>
    stringValue(item, `tradingDates[${index}]`),
  )

  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    market: marketCode(data.market, 'market'),
    timeZone: stringValue(data.timeZone, 'timeZone'),
    coverage: {
      from: stringValue(coverage.from, 'coverage.from'),
      to: stringValue(coverage.to, 'coverage.to'),
    },
    tradingDates: [...new Set(tradingDates)].sort(),
    closures: arrayValue(data.closures, 'closures').map(parseClosure),
    source: parseSource(data.source),
  }
}

function parseManifestItem(value: unknown, index: number): AssetManifestItem {
  const item = record(value, `assets[${index}]`)
  return {
    id: stringValue(item.id, `assets[${index}].id`),
    alias: stringValue(item.alias, `assets[${index}].alias`),
    kind: assetKind(item.kind, `assets[${index}].kind`),
    market: marketCode(item.market, `assets[${index}].market`),
    currency: currency(item.currency, `assets[${index}].currency`),
    sector: stringValue(item.sector, `assets[${index}].sector`),
    listedFrom: stringValue(item.listedFrom, `assets[${index}].listedFrom`),
    dataPath: stringValue(item.dataPath, `assets[${index}].dataPath`),
  }
}

export function parseMarketDataManifest(value: unknown): MarketDataManifest {
  const data = record(value, 'manifest')
  const calendars = record(data.calendars, 'calendars')
  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    calendars: {
      KR: stringValue(calendars.KR, 'calendars.KR'),
      US: stringValue(calendars.US, 'calendars.US'),
    },
    assets: arrayValue(data.assets, 'assets').map(parseManifestItem),
  }
}

function parseDailyBar(value: unknown, index: number): DailyBar {
  const item = record(value, `bars[${index}]`)
  return {
    date: stringValue(item.date, `bars[${index}].date`),
    open: numberValue(item.open, `bars[${index}].open`),
    high: numberValue(item.high, `bars[${index}].high`),
    low: numberValue(item.low, `bars[${index}].low`),
    close: numberValue(item.close, `bars[${index}].close`),
    volume: numberValue(item.volume, `bars[${index}].volume`),
  }
}

function parseAssetPriceSource(value: unknown): AssetPriceSource {
  const item = record(value, 'asset price source')
  if (item.priceBasis !== 'historical-unadjusted') {
    throw new DataSchemaError('asset price source.priceBasis must be historical-unadjusted')
  }
  return {
    authoritativeProvider: stringValue(item.authoritativeProvider, 'asset price source.authoritativeProvider'),
    priceBasis: item.priceBasis,
    splitAdjustmentPolicy: stringValue(item.splitAdjustmentPolicy, 'asset price source.splitAdjustmentPolicy'),
    generatedAt: stringValue(item.generatedAt, 'asset price source.generatedAt'),
    splitRestorationCount: numberValue(item.splitRestorationCount, 'asset price source.splitRestorationCount'),
  }
}

export function parseAssetPriceSeries(value: unknown): AssetPriceSeries {
  const data = record(value, 'asset price series')
  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    id: stringValue(data.id, 'id'),
    market: marketCode(data.market, 'market'),
    kind: assetKind(data.kind, 'kind'),
    currency: currency(data.currency, 'currency'),
    source: data.source === undefined ? undefined : parseAssetPriceSource(data.source),
    bars: arrayValue(data.bars, 'bars').map(parseDailyBar),
  }
}
