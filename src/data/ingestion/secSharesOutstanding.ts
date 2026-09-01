type JsonRecord = Record<string, unknown>

export interface SecSharesOutstandingSnapshot {
  asOfDate: string
  availableFrom: string
  sharesOutstanding: number
  form: string
}

interface NormalizedSecShareFact extends SecSharesOutstandingSnapshot {
  accession: string | null
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

function normalizeRows(rows: unknown[]): NormalizedSecShareFact[] {
  return rows.flatMap((raw) => {
    const item = record(raw)
    if (!item || typeof item.end !== 'string' || typeof item.filed !== 'string' || typeof item.form !== 'string') return []
    if (typeof item.val !== 'number' || !Number.isFinite(item.val) || item.val <= 0) return []
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.end) || !/^\d{4}-\d{2}-\d{2}$/.test(item.filed)) return []
    return [{
      asOfDate: item.end,
      availableFrom: item.filed,
      sharesOutstanding: item.val,
      form: item.form,
      accession: typeof item.accn === 'string' && item.accn.trim() ? item.accn.trim() : null,
    }]
  })
}

function filingKey(item: NormalizedSecShareFact): string {
  return item.accession ?? `${item.availableFrom}|${item.form}`
}

function aggregateRows(
  rows: readonly NormalizedSecShareFact[],
  mode: 'sum' | 'max',
): NormalizedSecShareFact[] {
  const grouped = new Map<string, NormalizedSecShareFact[]>()
  for (const row of rows) {
    const key = `${filingKey(row)}|${row.availableFrom}|${row.asOfDate}|${row.form}`
    const values = grouped.get(key) ?? []
    values.push(row)
    grouped.set(key, values)
  }

  return [...grouped.values()].map((facts) => {
    const first = facts[0]
    const sharesOutstanding = mode === 'sum'
      ? facts.reduce((sum, fact) => sum + fact.sharesOutstanding, 0)
      : Math.max(...facts.map((fact) => fact.sharesOutstanding))
    if (!Number.isSafeInteger(sharesOutstanding) || sharesOutstanding <= 0) {
      throw new Error('SEC shares-outstanding aggregation produced an invalid value')
    }
    return {
      asOfDate: first.asOfDate,
      availableFrom: first.availableFrom,
      sharesOutstanding,
      form: first.form,
      accession: first.accession,
    }
  })
}

export function normalizeSecSharesOutstandingCompanyFacts(payload: unknown): SecSharesOutstandingSnapshot[] {
  const deiRows = normalizeRows(factRows(payload, 'dei', 'EntityCommonStockSharesOutstanding'))
  const gaapRows = normalizeRows(factRows(payload, 'us-gaap', 'CommonStockSharesOutstanding'))
  const deiFilings = new Set(deiRows.map(filingKey))
  const candidates = [
    ...aggregateRows(deiRows, 'sum'),
    ...aggregateRows(gaapRows.filter((row) => !deiFilings.has(filingKey(row))), 'max'),
  ]
  const deduped = new Map<string, SecSharesOutstandingSnapshot>()
  for (const item of candidates) {
    const key = `${item.availableFrom}|${item.asOfDate}|${item.sharesOutstanding}|${item.form}`
    deduped.set(key, {
      asOfDate: item.asOfDate,
      availableFrom: item.availableFrom,
      sharesOutstanding: item.sharesOutstanding,
      form: item.form,
    })
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