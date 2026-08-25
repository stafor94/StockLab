import type { FxRatePoint } from '../../types/fx'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatDate(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
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
    if (!isObject(raw) || typeof raw.TIME !== 'string') continue
    const date = formatDate(raw.TIME)
    if (!date) continue
    const number = typeof raw.DATA_VALUE === 'number'
      ? raw.DATA_VALUE
      : typeof raw.DATA_VALUE === 'string'
        ? Number(raw.DATA_VALUE.replaceAll(',', ''))
        : Number.NaN
    if (!Number.isFinite(number) || number <= 0) continue
    byDate.set(date, number)
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, usdKrw]) => ({ date, usdKrw }))
}
