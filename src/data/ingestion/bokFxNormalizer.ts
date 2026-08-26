import { BOK_USD_KRW_SERIES } from '../fxSeries'
import type { FxRatePoint } from '../../types/fx'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatDate(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null
  const formatted = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  const parsed = new Date(`${formatted}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== formatted) return null
  return formatted
}

export function normalizeBokEcosUsdKrw(payload: unknown): FxRatePoint[] {
  if (!isObject(payload)) throw new Error('Invalid BOK ECOS payload')
  const result = payload.RESULT
  if (isObject(result) && typeof result.MESSAGE === 'string') {
    throw new Error(`BOK ECOS error: ${result.MESSAGE}`)
  }
  const search = payload.StatisticSearch
  if (!isObject(search) || !Array.isArray(search.row)) {
    throw new Error('BOK ECOS response does not contain StatisticSearch.row')
  }

  const byDate = new Map<string, number>()
  for (const raw of search.row) {
    if (!isObject(raw)) throw new Error('BOK ECOS response contains an invalid row')
    if (raw.STAT_CODE !== BOK_USD_KRW_SERIES.statCode || raw.ITEM_CODE1 !== BOK_USD_KRW_SERIES.itemCode) {
      throw new Error('BOK ECOS response row does not match the configured USD/KRW series')
    }
    if (typeof raw.TIME !== 'string') throw new Error('BOK ECOS FX row is missing TIME')
    const date = formatDate(raw.TIME)
    if (!date) throw new Error(`BOK ECOS FX row has invalid TIME: ${raw.TIME}`)
    const number = typeof raw.DATA_VALUE === 'number'
      ? raw.DATA_VALUE
      : typeof raw.DATA_VALUE === 'string'
        ? Number(raw.DATA_VALUE.replaceAll(',', ''))
        : Number.NaN
    if (!Number.isFinite(number) || number <= 0) {
      throw new Error(`BOK ECOS FX row has invalid DATA_VALUE for ${date}`)
    }
    if (byDate.has(date)) throw new Error(`BOK ECOS FX response contains duplicate date ${date}`)
    byDate.set(date, number)
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, usdKrw]) => ({ date, usdKrw }))
}
