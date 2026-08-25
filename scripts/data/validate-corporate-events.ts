import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCorporateEventDataset } from '../../src/data/corporateEventSchema'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const path = join(ROOT, 'public', 'data', 'events', 'corporate.json')
const value = JSON.parse(await readFile(path, 'utf8')) as unknown
const parsed = parseCorporateEventDataset(value)
if (parsed.source.mode === 'generated' && parsed.events.length === 0) {
  throw new Error('Generated corporate event dataset is unexpectedly empty')
}
console.log(`Validated ${parsed.events.length} corporate events (${parsed.source.mode})`)
