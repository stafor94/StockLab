type JsonRecord = Record<string, unknown>

export interface NasdaqSplitRow {
  symbol: string
  effectiveDate: string
  numerator: number
  denominator: number
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function findCandidateRows(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    const records = value.filter(isRecord)
    if (records.some((row) => firstString(row, ['symbol', 'ticker']) && firstString(row, ['ratio', 'splitRatio']))) {
      return records
    }
    for (const item of value) {
      const nested = findCandidateRows(item)
      if (nested.length > 0) return nested
    }
    return []
  }
  if (!isRecord(value)) return []
  for (const nestedValue of Object.values(value)) {
    const nested = findCandidateRows(nestedValue)
    if (nested.length > 0) return nested
  }
  return []
}

function parseRatio(value: string): { numerator: number; denominator: number } | null {
  const normalized = value.replace(/\s+/g, ' ').trim()
  const match = /([0-9]+(?:\.[0-9]+)?)\s*(?::|\/|for|to|-)+\s*([0-9]+(?:\.[0-9]+)?)/i.exec(normalized)
  if (!match) return null
  const numerator = Number(match[1])
  const denominator = Number(match[2])
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) return null
  return { numerator, denominator }
}

function normalizeDate(value: string | null, fallback: string): string {
  if (!value) return fallback
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  return match ? `${match[3]}-${match[1]}-${match[2]}` : fallback
}

export function normalizeNasdaqSplitCalendarPayload(
  payload: unknown,
  requestedDate: string,
): NasdaqSplitRow[] {
  const rows = findCandidateRows(payload)
  const normalized: NasdaqSplitRow[] = []
  for (const row of rows) {
    const symbol = firstString(row, ['symbol', 'ticker'])
    const ratioText = firstString(row, ['ratio', 'splitRatio'])
    if (!symbol || !ratioText) continue
    const ratio = parseRatio(ratioText)
    if (!ratio) continue
    normalized.push({
      symbol: symbol.toUpperCase(),
      effectiveDate: normalizeDate(firstString(row, [
        'executionDate',
        'effectiveDate',
        'exDate',
        'date',
      ]), requestedDate),
      ...ratio,
    })
  }
  return normalized
}
