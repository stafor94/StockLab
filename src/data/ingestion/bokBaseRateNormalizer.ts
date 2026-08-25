import type { BaseRatePoint } from '../../types/rates'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isoDate(compact: string): string {
  if (!/^\d{8}$/.test(compact)) throw new Error(`Invalid ECOS date: ${compact}`)
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
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
    const annualRate = Number(row.DATA_VALUE.replaceAll(',', ''))
    if (!Number.isFinite(annualRate) || annualRate < 0) throw new Error('Invalid BOK ECOS base-rate value')
    return { date: isoDate(row.TIME), annualRate }
  }).sort((a, b) => a.date.localeCompare(b.date))

  const deduped: BaseRatePoint[] = []
  for (const row of rows) {
    const existing = deduped.at(-1)
    if (existing?.date === row.date) {
      existing.annualRate = row.annualRate
      continue
    }
    if (existing?.annualRate === row.annualRate) continue
    deduped.push(row)
  }
  return deduped
}
