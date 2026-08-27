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

function optionalPositiveNumber(value: unknown): number | null {
  const text = String(value ?? '').replaceAll(',', '').trim()
  if (text === '' || text === '-' || text === 'N/A') return null
  const normalized = Number(text)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null
}

function isTargetRow(row: JsonRecord, target: KrxMajorIndex): boolean {
  const typeCode = String(row.ind_tp_cd ?? '').trim()
  const indexCode = String(row.idx_ind_cd ?? '').trim()
  const name = String(row.idx_nm ?? '').replace(/\s+/g, ' ').trim()
  if (typeCode !== 'Z') return false
  if (target === 'KOSPI') return indexCode === '001' && name.includes('코스피') && !name.includes('코스닥')
  return indexCode === '002' && name.includes('코스닥')
}

export function normalizeKrxIndexDailyPayload(
  payload: unknown,
  options: { date: string; target: KrxMajorIndex },
): DailyBar | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new KrxIndexDataError('KRX index query date must use YYYY-MM-DD')
  }
  const root = record(payload, 'KRX index response')
  if (!Array.isArray(root.block1)) throw new KrxIndexDataError('KRX index response.block1 must be an array')

  const rows = root.block1.map((value, index) => record(value, `KRX index row ${index}`))
  const targetRows = rows.filter((row) => isTargetRow(row, options.target))
  if (targetRows.length > 1) {
    throw new KrxIndexDataError(`KRX index response contains duplicate ${options.target} representative rows`)
  }
  const row = targetRows[0]
  if (!row) return null

  const open = optionalPositiveNumber(row.opnprc_idx)
  const high = optionalPositiveNumber(row.hgprc_idx)
  const low = optionalPositiveNumber(row.lwprc_idx)
  const close = optionalPositiveNumber(row.clsprc_idx)
  if (open === null && high === null && low === null && close === null) return null
  if (open === null || high === null || low === null || close === null) {
    throw new KrxIndexDataError(`${options.target} has incomplete official OHLC on ${options.date}`)
  }
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    throw new KrxIndexDataError(`${options.target} has inconsistent official OHLC on ${options.date}`)
  }

  return { date: options.date, open, high, low, close, volume: null }
}
