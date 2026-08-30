import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { readJson } from './io'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SNAPSHOT_ROOT = join(ROOT, 'config', 'sec-shares-snapshots')
const EXPECTED_US_STOCK_COUNT = 45
const SNAPSHOT_FIELDS = new Set(['asOfDate', 'availableFrom', 'sharesOutstanding', 'form'])

type JsonRecord = Record<string, unknown>

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as JsonRecord
}

function calendarDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid calendar date`)
  return value
}

function positiveSafeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`)
  }
  return value
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`)
  return value
}

function validateSnapshotArray(value: unknown, assetId: string): void {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${assetId}: static SEC snapshot array must be non-empty`)

  const seen = new Set<string>()
  let previousAvailableFrom: string | null = null
  for (const [index, raw] of value.entries()) {
    const item = record(raw, `${assetId}[${index}]`)
    const keys = Object.keys(item)
    if (keys.length !== SNAPSHOT_FIELDS.size || keys.some((key) => !SNAPSHOT_FIELDS.has(key))) {
      throw new Error(`${assetId}[${index}]: static SEC snapshot entries may contain only the approved snapshot fields`)
    }

    const asOfDate = calendarDate(item.asOfDate, `${assetId}[${index}].asOfDate`)
    const availableFrom = calendarDate(item.availableFrom, `${assetId}[${index}].availableFrom`)
    const sharesOutstanding = positiveSafeInteger(item.sharesOutstanding, `${assetId}[${index}].sharesOutstanding`)
    const form = nonEmptyString(item.form, `${assetId}[${index}].form`)

    if (previousAvailableFrom !== null && availableFrom < previousAvailableFrom) {
      throw new Error(`${assetId}: availableFrom must be sorted in ascending order`)
    }
    previousAvailableFrom = availableFrom

    const duplicateKey = `${asOfDate}\u0000${availableFrom}\u0000${sharesOutstanding}\u0000${form}`
    if (seen.has(duplicateKey)) throw new Error(`${assetId}: duplicate static SEC snapshot detected`)
    seen.add(duplicateKey)
  }
}

async function main(): Promise<void> {
  const usStocks = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'stock')
  if (usStocks.length !== EXPECTED_US_STOCK_COUNT) {
    throw new Error(`Static SEC snapshot validation expects exactly ${EXPECTED_US_STOCK_COUNT} U.S. stock game assets; catalog has ${usStocks.length}`)
  }

  const expectedFiles = new Set(usStocks.map((asset) => `${asset.id}.json`))
  const entries = await readdir(SNAPSHOT_ROOT, { withFileTypes: true })
  const actualJsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name)
  const unexpected = actualJsonFiles.filter((name) => !expectedFiles.has(name))
  if (unexpected.length > 0) throw new Error(`Static SEC snapshot directory contains ${unexpected.length} unexpected JSON file(s)`)

  let validated = 0
  for (const asset of usStocks) {
    const fileName = `${asset.id}.json`
    if (!actualJsonFiles.includes(fileName)) continue
    validateSnapshotArray(await readJson(join(SNAPSHOT_ROOT, fileName)), asset.id)
    validated += 1
  }

  if (validated !== EXPECTED_US_STOCK_COUNT) {
    throw new Error(`Static SEC snapshots are incomplete: validated ${validated}/${EXPECTED_US_STOCK_COUNT} U.S. stock game assets`)
  }
  console.log(`Validated ${validated}/${EXPECTED_US_STOCK_COUNT} static SEC shares-outstanding snapshot files.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
