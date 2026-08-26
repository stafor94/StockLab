import type { DailyBar } from '../../types/market'

type JsonRecord = Record<string, unknown>

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

function providerNumber(value: unknown, label: string): number {
  const normalized = Number(String(value ?? '').replaceAll(',', '').trim())
  if (!Number.isFinite(normalized)) throw new KrxIndexDataError(`${label} must be numeric`)
  return normalized
}

function providerVolume(value: unknown, label: string): number | null {
  const text = String(value ?? '').replaceAll(',', '').trim()
  if (text === '' || text === '-' || text === 'N/A') return null
  const volume = Number(text)
  if (!Number.isFinite(volume) || volume < 0) throw new KrxIndexDataError(`${label} must be non-negative`)
  return volume
}

function providerDate(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new KrxIndexDataError(`${label} must be a string`)
  const compact = value.trim()
  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  }
  const normalized = compact.replaceAll('/', '-').replaceAll('.', '-')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new KrxIndexDataError(`${label} must use YYYYMMDD or a YYYY-MM-DD equivalent`)
  }
  return normalized
}

export function normalizeKrxIndexPayload(payload: unknown, indexName: string): DailyBar[] {
  const root = record(payload, 'KRX index response')
  if (!Array.isArray(root.OutBlock_1)) throw new KrxIndexDataError('KRX index response.OutBlock_1 must be an array')

  const bars = root.OutBlock_1
    .map((rawRow, index) => record(rawRow, `KRX index row ${index}`))
    .filter((row) => row.IDX_NM === indexName)
    .map((row) => {
      const date = providerDate(row.BAS_DD, `KRX ${indexName}.BAS_DD`)
      const bar: DailyBar = {
        date,
        open: providerNumber(row.OPNPRC_IDX, `${date}.OPNPRC_IDX`),
        high: providerNumber(row.HGPRC_IDX, `${date}.HGPRC_IDX`),
        low: providerNumber(row.LWPRC_IDX, `${date}.LWPRC_IDX`),
        close: providerNumber(row.CLSPRC_IDX, `${date}.CLSPRC_IDX`),
        volume: providerVolume(row.ACC_TRDVOL, `${date}.ACC_TRDVOL`),
      }
      if (![bar.open, bar.high, bar.low, bar.close].every((value) => value > 0)) {
        throw new KrxIndexDataError(`${date} OHLC values must be positive`)
      }
      return bar
    })
    .sort((left, right) => left.date.localeCompare(right.date))

  for (let index = 1; index < bars.length; index += 1) {
    if (bars[index - 1].date === bars[index].date) {
      throw new KrxIndexDataError(`KRX index response contains duplicate date ${bars[index].date}`)
    }
  }
  return bars
}
