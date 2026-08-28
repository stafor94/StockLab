type JsonRecord = Record<string, unknown>

export interface SecSharesOutstandingSnapshot {
  asOfDate: string
  availableFrom: string
  sharesOutstanding: number
  form: string
}

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null
}

function factRows(payload: unknown, namespace: string, tag: string): unknown[] {
  const root = record(payload)
  const facts = record(root?.facts)
  const ns = record(facts?.[namespace])
  const fact = record(ns?.[tag])
  const units = record(fact?.units)
  const shares = units?.shares
  return Array.isArray(shares) ? shares : []
}

function normalizeRows(rows: unknown[]): SecSharesOutstandingSnapshot[] {
  return rows.flatMap((raw) => {
    const item = record(raw)
    if (!item || typeof item.end !== 'string' || typeof item.filed !== 'string' || typeof item.form !== 'string') return []
    if (typeof item.val !== 'number' || !Number.isFinite(item.val) || item.val <= 0) return []
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.end) || !/^\d{4}-\d{2}-\d{2}$/.test(item.filed)) return []
    return [{ asOfDate: item.end, availableFrom: item.filed, sharesOutstanding: item.val, form: item.form }]
  })
}

export function normalizeSecSharesOutstandingCompanyFacts(payload: unknown): SecSharesOutstandingSnapshot[] {
  const candidates = [
    ...normalizeRows(factRows(payload, 'dei', 'EntityCommonStockSharesOutstanding')),
    ...normalizeRows(factRows(payload, 'us-gaap', 'CommonStockSharesOutstanding')),
  ]
  const deduped = new Map<string, SecSharesOutstandingSnapshot>()
  for (const item of candidates) {
    const key = `${item.availableFrom}|${item.asOfDate}|${item.sharesOutstanding}`
    deduped.set(key, item)
  }
  return [...deduped.values()].sort((left, right) =>
    left.availableFrom.localeCompare(right.availableFrom) || left.asOfDate.localeCompare(right.asOfDate),
  )
}

export function selectSecSharesAvailableBefore(
  snapshots: readonly SecSharesOutstandingSnapshot[],
  tradingDate: string,
): SecSharesOutstandingSnapshot | null {
  let selected: SecSharesOutstandingSnapshot | null = null
  for (const item of snapshots) {
    if (item.availableFrom >= tradingDate) continue
    if (!selected || item.availableFrom > selected.availableFrom || (
      item.availableFrom === selected.availableFrom && item.asOfDate > selected.asOfDate
    )) selected = item
  }
  return selected
}
