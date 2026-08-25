import type { DailyBar } from '../../types/market'

type JsonRecord = Record<string, unknown>

export class SourceDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceDataError'
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SourceDataError(`${label} must be an object`)
  }
  return value as JsonRecord
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SourceDataError(`${label} must be a non-empty string`)
  }
  return value.trim()
}

function providerNumber(value: unknown, label: string): number {
  const normalized = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replaceAll(',', '').trim())

  if (!Number.isFinite(normalized)) {
    throw new SourceDataError(`${label} must be numeric`)
  }
  return normalized
}

function compactDateToIso(value: unknown, label: string): string {
  const compact = stringValue(value, label)
  if (!/^\d{8}$/.test(compact)) {
    throw new SourceDataError(`${label} must use YYYYMMDD`)
  }
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
}

function assertIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new SourceDataError(`${label} must use a valid YYYY-MM-DD date`)
  }
  return value
}

function validateBar(bar: DailyBar, label: string): DailyBar {
  if (bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0) {
    throw new SourceDataError(`${label} OHLC values must be positive`)
  }
  if (bar.volume !== null && bar.volume < 0) {
    throw new SourceDataError(`${label}.volume must be non-negative`)
  }
  if (bar.high < Math.max(bar.open, bar.close, bar.low)) {
    throw new SourceDataError(`${label}.high is inconsistent with OHLC values`)
  }
  if (bar.low > Math.min(bar.open, bar.close, bar.high)) {
    throw new SourceDataError(`${label}.low is inconsistent with OHLC values`)
  }
  return bar
}

export interface NormalizedKrxRow {
  symbol: string
  bar: DailyBar
}

export function normalizeKrxDailyPayload(payload: unknown): NormalizedKrxRow[] {
  const root = record(payload, 'KRX response')
  if (!Array.isArray(root.OutBlock_1)) {
    throw new SourceDataError('KRX response.OutBlock_1 must be an array')
  }

  const normalized: NormalizedKrxRow[] = []
  root.OutBlock_1.forEach((rawRow, index) => {
    const row = record(rawRow, `KRX row ${index}`)
    const open = providerNumber(row.TDD_OPNPRC, `KRX row ${index}.TDD_OPNPRC`)
    const high = providerNumber(row.TDD_HGPRC, `KRX row ${index}.TDD_HGPRC`)
    const low = providerNumber(row.TDD_LWPRC, `KRX row ${index}.TDD_LWPRC`)
    const close = providerNumber(row.TDD_CLSPRC, `KRX row ${index}.TDD_CLSPRC`)

    // Suspended/no-trade rows can contain zero prices. They are not executable daily bars.
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      return
    }

    const bar = validateBar({
      date: compactDateToIso(row.BAS_DD, `KRX row ${index}.BAS_DD`),
      open,
      high,
      low,
      close,
      volume: providerNumber(row.ACC_TRDVOL, `KRX row ${index}.ACC_TRDVOL`),
    }, `KRX row ${index}`)

    normalized.push({
      symbol: stringValue(row.ISU_CD, `KRX row ${index}.ISU_CD`),
      bar,
    })
  })

  return normalized
}

function alphaVantageError(root: JsonRecord): string | null {
  for (const key of ['Error Message', 'Note', 'Information']) {
    if (typeof root[key] === 'string' && root[key].trim().length > 0) {
      return root[key].trim()
    }
  }
  return null
}

export interface DateRange {
  from: string
  to: string
}

// Retained only for historical test compatibility; the production U.S. price path uses Nasdaq Historical Quotes.
export function normalizeAlphaVantageDailyPayload(
  payload: unknown,
  range?: DateRange,
): DailyBar[] {
  const root = record(payload, 'Alpha Vantage response')
  const providerError = alphaVantageError(root)
  if (providerError) {
    throw new SourceDataError(`Alpha Vantage error: ${providerError}`)
  }

  const series = record(root['Time Series (Daily)'], 'Alpha Vantage Time Series (Daily)')
  const from = range ? assertIsoDate(range.from, 'range.from') : null
  const to = range ? assertIsoDate(range.to, 'range.to') : null

  const bars = Object.entries(series)
    .filter(([date]) => (!from || date >= from) && (!to || date <= to))
    .map(([date, rawBar]) => {
      assertIsoDate(date, `Alpha Vantage date ${date}`)
      const item = record(rawBar, `Alpha Vantage bar ${date}`)
      return validateBar({
        date,
        open: providerNumber(item['1. open'], `${date}.open`),
        high: providerNumber(item['2. high'], `${date}.high`),
        low: providerNumber(item['3. low'], `${date}.low`),
        close: providerNumber(item['4. close'], `${date}.close`),
        volume: providerNumber(item['5. volume'], `${date}.volume`),
      }, `Alpha Vantage bar ${date}`)
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const uniqueDates = new Set(bars.map((bar) => bar.date))
  if (uniqueDates.size !== bars.length) {
    throw new SourceDataError('Alpha Vantage daily series contains duplicate dates')
  }
  return bars
}
