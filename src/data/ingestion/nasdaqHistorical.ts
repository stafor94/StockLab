import type { DailyBar } from '../../types/market'

type JsonRecord = Record<string, unknown>

const OHLC_RELATIVE_SANITY_TOLERANCE = 0.01

export class NasdaqHistoricalDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NasdaqHistoricalDataError'
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new NasdaqHistoricalDataError(`${label} must be an object`)
  }
  return value as JsonRecord
}

function providerNumber(value: unknown, label: string): number {
  const normalized = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replaceAll('$', '').replaceAll(',', '').trim())
  if (!Number.isFinite(normalized)) {
    throw new NasdaqHistoricalDataError(`${label} must be numeric`)
  }
  return normalized
}

function rowDate(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new NasdaqHistoricalDataError(`${label} must be a string`)
  }
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)
  if (!match) {
    throw new NasdaqHistoricalDataError(`${label} must use MM/DD/YYYY or YYYY-MM-DD`)
  }
  return `${match[3]}-${match[1]}-${match[2]}`
}

function relativeDifference(left: number, right: number): number {
  const scale = Math.max(Math.abs(left), Math.abs(right))
  return scale === 0 ? 0 : Math.abs(left - right) / scale
}

function validateBar(bar: DailyBar, label: string): DailyBar {
  if (![bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value) && value > 0)) {
    throw new NasdaqHistoricalDataError(`${label} OHLC values must be finite and positive`)
  }
  if (!Number.isFinite(bar.volume) || bar.volume < 0) {
    throw new NasdaqHistoricalDataError(`${label}.volume must be finite and non-negative`)
  }

  // Nasdaq Historical Quotes can contain small cross-field discrepancies after its
  // own historical adjustment/rounding. Preserve the authoritative provider values
  // verbatim; reject only materially inconsistent rows instead of silently clamping.
  const expectedHighFloor = Math.max(bar.open, bar.close, bar.low)
  if (
    bar.high < expectedHighFloor
    && relativeDifference(bar.high, expectedHighFloor) > OHLC_RELATIVE_SANITY_TOLERANCE
  ) {
    throw new NasdaqHistoricalDataError(
      `${label}.high is materially inconsistent with OHLC values (open=${bar.open}, high=${bar.high}, low=${bar.low}, close=${bar.close})`,
    )
  }

  const expectedLowCeiling = Math.min(bar.open, bar.close, bar.high)
  if (
    bar.low > expectedLowCeiling
    && relativeDifference(bar.low, expectedLowCeiling) > OHLC_RELATIVE_SANITY_TOLERANCE
  ) {
    throw new NasdaqHistoricalDataError(
      `${label}.low is materially inconsistent with OHLC values (open=${bar.open}, high=${bar.high}, low=${bar.low}, close=${bar.close})`,
    )
  }
  return bar
}

export interface NasdaqDateRange {
  from: string
  to: string
}

export function normalizeNasdaqHistoricalPayload(
  payload: unknown,
  range?: NasdaqDateRange,
): DailyBar[] {
  const root = record(payload, 'Nasdaq Historical Quotes response')
  if (root.data === null || root.data === undefined) return []
  const data = record(root.data, 'Nasdaq Historical Quotes response.data')
  if (data.tradesTable === null || data.tradesTable === undefined) return []
  const tradesTable = record(data.tradesTable, 'Nasdaq Historical Quotes tradesTable')
  const rawRows = tradesTable.rows
  if (rawRows === null || rawRows === undefined) return []
  if (!Array.isArray(rawRows)) {
    throw new NasdaqHistoricalDataError('Nasdaq Historical Quotes tradesTable.rows must be an array')
  }

  const from = range?.from ?? null
  const to = range?.to ?? null
  const bars = rawRows.map((rawRow, index) => {
    const item = record(rawRow, `Nasdaq Historical Quotes row ${index}`)
    const date = rowDate(item.date, `Nasdaq Historical Quotes row ${index}.date`)
    return validateBar({
      date,
      open: providerNumber(item.open, `${date}.open`),
      high: providerNumber(item.high, `${date}.high`),
      low: providerNumber(item.low, `${date}.low`),
      close: providerNumber(item.close, `${date}.close`),
      volume: providerNumber(item.volume ?? 0, `${date}.volume`),
    }, `Nasdaq Historical Quotes row ${date}`)
  }).filter((bar) => (!from || bar.date >= from) && (!to || bar.date <= to))
    .sort((left, right) => left.date.localeCompare(right.date))

  const dates = new Set<string>()
  for (const bar of bars) {
    if (dates.has(bar.date)) {
      throw new NasdaqHistoricalDataError(`Nasdaq Historical Quotes contains duplicate date ${bar.date}`)
    }
    dates.add(bar.date)
  }
  return bars
}

export function nasdaqHistoricalTotalRecords(payload: unknown): number | null {
  const root = record(payload, 'Nasdaq Historical Quotes response')
  if (root.data === null || root.data === undefined) return 0
  const data = record(root.data, 'Nasdaq Historical Quotes response.data')
  const value = data.totalRecords
  if (value === undefined || value === null || value === '') return null
  const total = providerNumber(value, 'Nasdaq Historical Quotes totalRecords')
  return Number.isInteger(total) && total >= 0 ? total : null
}
