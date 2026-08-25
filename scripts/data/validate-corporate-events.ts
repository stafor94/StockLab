import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { parseCorporateEventDataset } from '../../src/data/corporateEventSchema'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const path = join(ROOT, 'public', 'data', 'events', 'corporate.json')
const value = JSON.parse(await readFile(path, 'utf8')) as unknown
const parsed = parseCorporateEventDataset(value)
const knownAssets = new Set(ASSET_CATALOG.map((asset) => asset.id))

if ((parsed.source.mode === 'generated' || parsed.source.mode === 'curated-partial') && parsed.events.length === 0) {
  throw new Error(`${parsed.source.mode} corporate event dataset is unexpectedly empty`)
}

for (const event of parsed.events) {
  if (!knownAssets.has(event.assetId)) throw new Error(`Unknown corporate-event asset ${event.assetId} in ${event.id}`)
  if (event.date < parsed.coverage.from || event.date > parsed.coverage.to) {
    throw new Error(`Corporate event ${event.id} is outside dataset coverage`)
  }
  if (!event.source.reference.startsWith('https://')) {
    throw new Error(`Corporate event ${event.id} must use an HTTPS source reference`)
  }
}

console.log(`Validated ${parsed.events.length} corporate events (${parsed.source.mode})`)
