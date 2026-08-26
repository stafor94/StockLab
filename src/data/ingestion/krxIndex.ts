import type { DailyBar } from '../../types/market'

type JsonRecord = Record<string, unknown>
export type KrxMajorIndex = 'KOSPI' | 'KOSDAQ'

export class KrxIndexDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KrxIndexDataError'
  }
}

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new KrxIndexDataError(`${label} must be an object`)
  }
  return value as JsonRecord
}

function positiveNumber(value: unknown, label: string): number {
  const text = String(value ?? '').replaceAll(',', '').trim()
  const normalized = Number(text)
  if (!text || !Number.isFinite(normalized) || normalized <= 0) {
    throw new KrxIndexDataError(`${label} must be a positive number`)
  }
  return normalized
}

function nullableNonNegativeNumber(value: unknown, label: string): number | null {
  const text = String(value ?? '').replaceAll(',', '').trim()
  if (!text || text === '-' || text === 'N/A') return null
  const normalized = Number(text)
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new KrxIndexDataError(`${label} must be a non-negative number`)
  }
  return normalized
}

function normalizeDate(value: unknown): string {
  const text = String(value ?? '').trim()
  const match = /^(\d{4})[/.\-](\d{2})[/.\-](\d{2})$/.exec(text)
  if (!match) throw new KrxIndexDataError(`invalid KRX index date: ${text}`)
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function normalizeKrxIndexHistoryPayload(
  payload: unknown,
  options: { target: KrxMajorIndex },
): DailyBar[] {
  const root = record(payload, 'KRX index response')
  if (!Array.isArray(root.output)) throw new KrxIndexDataError('KRX index response.output must be an array')

  const byDate = new Map<string, DailyBar>()
  root.output.forEach((value, index) => {
    const row = record(value, `KRX index row ${index}`)
    const date = normalizeDate(row.TRD_DD)
    const bar: DailyBar = {
      date,
      open: positiveNumber(row.OPNPRC_IDX, `${options.target} open on ${date}`),
      high: positiveNumber(row.HGPRC_IDX, `${options.target} high on ${date}`),
      low: positiveNumber(row.LWPRC_IDX, `${options.target} low on ${date}`),
      close: positiveNumber(row.CLSPRC_IDX, `${options.target} close on ${date}`),
      volume: nullableNonNegativeNumber(row.ACC_TRDVOL, `${options.target} volume on ${date}`),
    }
    if (bar.high < Math.max(bar.open, bar.close, bar.low)) {
      throw new KrxIndexDataError(`${options.target} high is inconsistent on ${date}`)
    }
    if (bar.low > Math.min(bar.open, bar.close, bar.high)) {
      throw new KrxIndexDataError(`${options.target} low is inconsistent on ${date}`)
    }
    const existing = byDate.get(date)
    if (existing && JSON.stringify(existing) !== JSON.stringify(bar)) {
      throw new KrxIndexDataError(`${options.target} has conflicting duplicate rows on ${date}`)
    }
    byDate.set(date, bar)
  })

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}
