import type { BaseRatePoint } from '../../types/rates'

const BOK_BASE_RATE_STAT_CODE = '722Y001'
const BOK_BASE_RATE_ITEM_CODE = '0101000'
const BOK_BASE_RATE_ITEM_NAME = '한국은행 기준금리'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isoDate(compact: string): string {
  if (!/^\d{8}$/.test(compact)) throw new Error(`Invalid ECOS date: ${compact}`)
  const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid ECOS date: ${compact}`)
  }
  return date
}

function assertExpectedSeries(row: Record<string, unknown>): void {
  if (row.STAT_CODE !== undefined && row.STAT_CODE !== BOK_BASE_RATE_STAT_CODE) {
    throw new Error(`Unexpected BOK ECOS stat code: ${String(row.STAT_CODE)}`)
  }
  if (row.ITEM_CODE1 !== undefined && row.ITEM_CODE1 !== BOK_BASE_RATE_ITEM_CODE) {
    throw new Error(`Unexpected BOK ECOS item code: ${String(row.ITEM_CODE1)}`)
  }
  if (row.ITEM_NAME1 !== undefined && row.ITEM_NAME1 !== BOK_BASE_RATE_ITEM_NAME) {
    throw new Error(`Unexpected BOK ECOS item name: ${String(row.ITEM_NAME1)}`)
  }
}

export function normalizeBokEcosBaseRates(payload: unknown): BaseRatePoint[] {
  if (!isObject(payload)) throw new Error('Invalid BOK ECOS payload')
  const result = payload.StatisticSearch
  if (!isObject(result) || !Array.isArray(result.row)) {
    const error = isObject(payload.RESULT) && typeof payload.RESULT.MESSAGE === 'string'
      ? payload.RESULT.MESSAGE
      : 'BOK ECOS base-rate response contains no rows'
    throw new Error(error)
  }

  const rows = result.row.map((row) => {
    if (!isObject(row) || typeof row.TIME !== 'string' || typeof row.DATA_VALUE !== 'string') {
      throw new Error('Invalid BOK ECOS base-rate row')
    }
    assertExpectedSeries(row)
    const annualRate = Number(row.DATA_VALUE.replaceAll(',', ''))
    if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 30) {
      throw new Error('Invalid BOK ECOS base-rate value')
    }
    return { date: isoDate(row.TIME), annualRate }
  }).sort((a, b) => a.date.localeCompare(b.date))

  const deduped: BaseRatePoint[] = []
  for (const row of rows) {
    const existing = deduped.at(-1)
    if (existing?.date === row.date) {
      if (existing.annualRate !== row.annualRate) {
        throw new Error(`Conflicting BOK ECOS base-rate values on ${row.date}`)
      }
      continue
    }
    if (existing?.annualRate === row.annualRate) continue
    deduped.push(row)
  }
  return deduped
}
