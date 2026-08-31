import {
  normalizeSecSharesOutstandingCompanyFacts,
  type SecSharesOutstandingSnapshot,
} from '../../src/data/ingestion/secSharesOutstanding'

type JsonRecord = Record<string, unknown>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null
}

function parseSnapshot(value: unknown, label: string): SecSharesOutstandingSnapshot {
  const item = record(value)
  if (!item) throw new Error(`${label} must be an object`)
  const { asOfDate, availableFrom, sharesOutstanding, form } = item
  if (typeof asOfDate !== 'string' || !DATE_PATTERN.test(asOfDate)) {
    throw new Error(`${label}.asOfDate must be YYYY-MM-DD`)
  }
  if (typeof availableFrom !== 'string' || !DATE_PATTERN.test(availableFrom)) {
    throw new Error(`${label}.availableFrom must be YYYY-MM-DD`)
  }
  if (availableFrom < asOfDate) throw new Error(`${label}.availableFrom must not precede asOfDate`)
  if (!Number.isSafeInteger(sharesOutstanding) || (sharesOutstanding as number) <= 0) {
    throw new Error(`${label}.sharesOutstanding must be a positive safe integer`)
  }
  if (typeof form !== 'string' || !form.trim()) throw new Error(`${label}.form must be a non-empty string`)
  return { asOfDate, availableFrom, sharesOutstanding: sharesOutstanding as number, form: form.trim() }
}

export function parseSecSharesSnapshotConfig(payload: unknown): Map<string, SecSharesOutstandingSnapshot[]> {
  const root = record(payload)
  if (!root || root.schemaVersion !== 1) throw new Error('SEC shares snapshot config must use schemaVersion 1')
  const assets = record(root.assets)
  if (!assets) throw new Error('SEC shares snapshot config assets must be an object')

  const result = new Map<string, SecSharesOutstandingSnapshot[]>()
  for (const [assetId, rawSnapshots] of Object.entries(assets)) {
    if (!/^U\d{3}$/.test(assetId)) throw new Error(`Invalid SEC shares snapshot asset id ${assetId}`)
    if (!Array.isArray(rawSnapshots) || rawSnapshots.length === 0) {
      throw new Error(`${assetId}: SEC shares snapshots must be a non-empty array`)
    }
    result.set(assetId, rawSnapshots.map((snapshot, index) => parseSnapshot(snapshot, `${assetId}[${index}]`)))
  }
  return result
}

export async function resolveSecSharesSnapshots(
  assetId: string,
  verifiedSnapshots: ReadonlyMap<string, readonly SecSharesOutstandingSnapshot[]>,
  loadCompanyFacts: () => Promise<unknown>,
): Promise<SecSharesOutstandingSnapshot[]> {
  const verified = verifiedSnapshots.get(assetId)
  if (verified) return verified.map((snapshot) => ({ ...snapshot }))
  return normalizeSecSharesOutstandingCompanyFacts(await loadCompanyFacts())
}
