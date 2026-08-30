import { join } from 'node:path'
import type { SecSharesOutstandingSnapshot } from '../../src/data/ingestion/secSharesOutstanding'
import { readJsonIfExists } from './io'

type JsonRecord = Record<string, unknown>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null
}

function parseSnapshot(assetId: string, raw: unknown, index: number): SecSharesOutstandingSnapshot {
  const item = record(raw)
  const asOfDate = item?.asOfDate
  const availableFrom = item?.availableFrom
  const sharesOutstanding = item?.sharesOutstanding
  const form = item?.form
  if (
    typeof asOfDate !== 'string'
    || !ISO_DATE.test(asOfDate)
    || typeof availableFrom !== 'string'
    || !ISO_DATE.test(availableFrom)
    || typeof sharesOutstanding !== 'number'
    || !Number.isSafeInteger(sharesOutstanding)
    || sharesOutstanding <= 0
    || typeof form !== 'string'
    || !form.trim()
  ) {
    throw new Error(`${assetId}: tracked SEC shares snapshot row ${index + 1} is invalid`)
  }
  return {
    asOfDate,
    availableFrom,
    sharesOutstanding,
    form: form.trim(),
  }
}

export function parseTrackedSecSharesSnapshots(assetId: string, payload: unknown): SecSharesOutstandingSnapshot[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`${assetId}: tracked SEC shares snapshot must be a non-empty array`)
  }
  return payload
    .map((item, index) => parseSnapshot(assetId, item, index))
    .sort((left, right) =>
      left.availableFrom.localeCompare(right.availableFrom) || left.asOfDate.localeCompare(right.asOfDate),
    )
}

export async function loadTrackedSecSharesSnapshots(
  snapshotRoot: string,
  assetId: string,
): Promise<SecSharesOutstandingSnapshot[]> {
  const snapshotPath = join(snapshotRoot, `${assetId}.json`)
  const payload = await readJsonIfExists(snapshotPath)
  if (payload === null) {
    throw new Error(`${assetId}: missing tracked SEC shares snapshot at ${snapshotPath}`)
  }
  return parseTrackedSecSharesSnapshots(assetId, payload)
}
