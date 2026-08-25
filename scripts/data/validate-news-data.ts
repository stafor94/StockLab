import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { parseNewsManifest, parseNewsYearDataset } from '../../src/data/newsSchema'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const newsRoot = join(ROOT, 'public', 'data', 'news')
const manifest = parseNewsManifest(JSON.parse(await readFile(join(newsRoot, 'manifest.json'), 'utf8')) as unknown)
const knownAssets = new Set(ASSET_CATALOG.map((asset) => asset.id))
const ids = new Set<string>()
const years = new Set<number>()
let itemCount = 0

for (const entry of manifest.years) {
  if (years.has(entry.year)) throw new Error(`Duplicate news manifest year: ${entry.year}`)
  years.add(entry.year)
  const dataset = parseNewsYearDataset(JSON.parse(await readFile(join(newsRoot, entry.path), 'utf8')) as unknown)
  if (dataset.year !== entry.year) throw new Error(`News year mismatch for ${entry.path}`)
  let previousSortKey = ''
  for (const item of dataset.items) {
    if (!item.date.startsWith(`${dataset.year}-`)) throw new Error(`News ${item.id} date does not match dataset year`)
    if (item.date < manifest.coverage.from || item.date > manifest.coverage.to) throw new Error(`News ${item.id} is outside manifest coverage`)
    if (ids.has(item.id)) throw new Error(`Duplicate news id: ${item.id}`)
    ids.add(item.id)
    const sortKey = `${item.date}:${item.id}`
    if (previousSortKey && sortKey < previousSortKey) throw new Error(`News ${item.id} is not in chronological order`)
    previousSortKey = sortKey
    for (const assetId of item.relatedAssetIds) if (!knownAssets.has(assetId)) throw new Error(`Unknown related asset ${assetId} in ${item.id}`)
    for (const reference of item.sourceReferences) if (!reference.startsWith('https://')) throw new Error(`News ${item.id} must use HTTPS source references`)
    itemCount += 1
  }
}

if (manifest.source.mode === 'curated' && manifest.years.length === 0) throw new Error('Curated news manifest must reference at least one year dataset')
console.log(`Validated ${itemCount} curated news items across ${manifest.years.length} year files (${manifest.source.mode})`)
