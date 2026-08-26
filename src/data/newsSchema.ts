import type { NewsCategory, NewsItem, NewsManifest, NewsMarket, NewsTiming, NewsYearDataset } from '../game/news/types'

export class NewsSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NewsSchemaError'
  }
}

type JsonRecord = Record<string, unknown>

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new NewsSchemaError(`${label} must be an object`)
  return value as JsonRecord
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new NewsSchemaError(`${label} must be a non-empty string`)
  return value
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new NewsSchemaError(`${label} must be a finite number`)
  return value
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new NewsSchemaError(`${label} must be a boolean`)
  return value
}

function stringArray(value: unknown, label: string, allowEmpty = true): string[] {
  if (!Array.isArray(value)) throw new NewsSchemaError(`${label} must be an array`)
  const items = value.map((entry, index) => stringValue(entry, `${label}[${index}]`))
  if (!allowEmpty && items.length === 0) throw new NewsSchemaError(`${label} must not be empty`)
  return items
}

function timing(value: unknown, label: string): NewsTiming {
  if (value !== 'PRE_OPEN' && value !== 'INTRADAY' && value !== 'POST_CLOSE') throw new NewsSchemaError(`${label} has an invalid timing`)
  return value
}

function category(value: unknown, label: string): NewsCategory {
  if (value !== 'COMPANY' && value !== 'MARKET' && value !== 'MACRO' && value !== 'POLICY') throw new NewsSchemaError(`${label} has an invalid category`)
  return value
}

function market(value: unknown, label: string): NewsMarket {
  if (value !== 'KR' && value !== 'US' && value !== 'GLOBAL') throw new NewsSchemaError(`${label} has an invalid market`)
  return value
}

function parseItem(value: unknown, index: number): NewsItem {
  const item = record(value, `items[${index}]`)
  return {
    id: stringValue(item.id, `items[${index}].id`),
    date: stringValue(item.date, `items[${index}].date`),
    timing: timing(item.timing, `items[${index}].timing`),
    category: category(item.category, `items[${index}].category`),
    market: market(item.market, `items[${index}].market`),
    headline: stringValue(item.headline, `items[${index}].headline`),
    summary: stringValue(item.summary, `items[${index}].summary`),
    article: stringArray(item.article, `items[${index}].article`, false),
    important: booleanValue(item.important, `items[${index}].important`),
    relatedAssetIds: stringArray(item.relatedAssetIds, `items[${index}].relatedAssetIds`),
    relatedSectors: stringArray(item.relatedSectors, `items[${index}].relatedSectors`),
    sourceReferences: stringArray(item.sourceReferences, `items[${index}].sourceReferences`, false),
  }
}

export function parseNewsManifest(value: unknown): NewsManifest {
  const data = record(value, 'news manifest')
  const coverage = record(data.coverage, 'coverage')
  const source = record(data.source, 'source')
  if (source.mode !== 'empty-seed' && source.mode !== 'curated') throw new NewsSchemaError('source.mode must be empty-seed or curated')
  if (source.generatedAt !== null && typeof source.generatedAt !== 'string') throw new NewsSchemaError('source.generatedAt must be string or null')
  if (!Array.isArray(data.years)) throw new NewsSchemaError('years must be an array')
  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    coverage: { from: stringValue(coverage.from, 'coverage.from'), to: stringValue(coverage.to, 'coverage.to') },
    source: { mode: source.mode, generatedAt: source.generatedAt },
    years: data.years.map((entry, index) => {
      const year = record(entry, `years[${index}]`)
      return { year: numberValue(year.year, `years[${index}].year`), path: stringValue(year.path, `years[${index}].path`) }
    }).sort((a, b) => a.year - b.year),
  }
}

export function parseNewsYearDataset(value: unknown): NewsYearDataset {
  const data = record(value, 'news year dataset')
  if (!Array.isArray(data.items)) throw new NewsSchemaError('items must be an array')
  return {
    schemaVersion: numberValue(data.schemaVersion, 'schemaVersion'),
    year: numberValue(data.year, 'year'),
    items: data.items.map(parseItem),
  }
}
