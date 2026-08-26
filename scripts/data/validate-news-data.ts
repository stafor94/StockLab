import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { parseNewsManifest, parseNewsYearDataset } from '../../src/data/newsSchema'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const newsRoot = join(ROOT, 'public', 'data', 'news')
const manifest = parseNewsManifest(JSON.parse(await readFile(join(newsRoot, 'manifest.json'), 'utf8')) as unknown)
const knownAssets = new Set(ASSET_CATALOG.map((asset) => asset.id))
const ids = new Set<string>()
const duplicateKeys = new Set<string>()
const years = new Set<number>()
const paths = new Set<string>()
const todayUtc = new Date().toISOString().slice(0, 10)
let itemCount = 0

function assertIsoDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} is not a valid calendar date`)
}

function normalizedHeadline(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

assertIsoDate(manifest.coverage.from, 'News coverage.from')
assertIsoDate(manifest.coverage.to, 'News coverage.to')
if (manifest.coverage.from > manifest.coverage.to) throw new Error('News coverage.from must not be after coverage.to')
if (manifest.coverage.to > todayUtc) throw new Error(`News coverage.to ${manifest.coverage.to} is in the future (${todayUtc})`)

const coverageStartYear = Number(manifest.coverage.from.slice(0, 4))
const coverageEndYear = Number(manifest.coverage.to.slice(0, 4))
const expectedYears = Array.from({ length: coverageEndYear - coverageStartYear + 1 }, (_, index) => coverageStartYear + index)
const manifestYears = manifest.years.map((entry) => entry.year)
if (JSON.stringify(manifestYears) !== JSON.stringify(expectedYears)) {
  throw new Error(`News manifest years must exactly cover ${coverageStartYear}-${coverageEndYear}`)
}

const diskYearFiles = (await readdir(newsRoot)).filter((name) => /^\d{4}\.json$/.test(name)).sort()
const manifestYearFiles = manifest.years.map((entry) => entry.path).sort()
if (JSON.stringify(diskYearFiles) !== JSON.stringify(manifestYearFiles)) {
  throw new Error(`News manifest/files mismatch: manifest=${manifestYearFiles.join(',')} disk=${diskYearFiles.join(',')}`)
}

for (const entry of manifest.years) {
  if (!Number.isInteger(entry.year)) throw new Error(`News manifest year must be an integer: ${entry.year}`)
  if (years.has(entry.year)) throw new Error(`Duplicate news manifest year: ${entry.year}`)
  if (paths.has(entry.path)) throw new Error(`Duplicate news manifest path: ${entry.path}`)
  if (entry.path !== `${entry.year}.json`) throw new Error(`News manifest path must be ${entry.year}.json`)
  years.add(entry.year)
  paths.add(entry.path)

  const dataset = parseNewsYearDataset(JSON.parse(await readFile(join(newsRoot, entry.path), 'utf8')) as unknown)
  if (dataset.schemaVersion !== manifest.schemaVersion) throw new Error(`News schema version mismatch for ${entry.path}`)
  if (dataset.year !== entry.year) throw new Error(`News year mismatch for ${entry.path}`)

  let previousSortKey = ''
  for (const item of dataset.items) {
    assertIsoDate(item.date, `News ${item.id} date`)
    if (!item.date.startsWith(`${dataset.year}-`)) throw new Error(`News ${item.id} date does not match dataset year`)
    if (item.date < manifest.coverage.from || item.date > manifest.coverage.to) throw new Error(`News ${item.id} is outside manifest coverage`)
    if (item.date > todayUtc) throw new Error(`News ${item.id} is dated in the future`)
    if (ids.has(item.id)) throw new Error(`Duplicate news id: ${item.id}`)
    ids.add(item.id)

    const sortKey = `${item.date}:${item.id}`
    if (previousSortKey && sortKey < previousSortKey) throw new Error(`News ${item.id} is not in chronological order`)
    previousSortKey = sortKey

    const duplicateKey = `${item.date}|${item.market}|${normalizedHeadline(item.headline)}`
    if (duplicateKeys.has(duplicateKey)) throw new Error(`Duplicate news event detected: ${item.id}`)
    duplicateKeys.add(duplicateKey)

    for (const assetId of item.relatedAssetIds) {
      if (!knownAssets.has(assetId)) throw new Error(`Unknown related asset ${assetId} in ${item.id}`)
    }

    if (item.important && item.relatedAssetIds.length === 0 && item.relatedSectors.length === 0) {
      throw new Error(`Important news ${item.id} must include related asset or sector metadata`)
    }

    const itemSources = new Set<string>()
    for (const reference of item.sourceReferences) {
      let url: URL
      try {
        url = new URL(reference)
      } catch {
        throw new Error(`News ${item.id} has an invalid source URL: ${reference}`)
      }
      if (url.protocol !== 'https:') throw new Error(`News ${item.id} must use HTTPS source references`)
      if (itemSources.has(reference)) throw new Error(`News ${item.id} contains a duplicate source reference`)
      itemSources.add(reference)
    }
    itemCount += 1
  }
}

if (manifest.source.mode === 'curated' && manifest.years.length === 0) throw new Error('Curated news manifest must reference at least one year dataset')
console.log(`Validated ${itemCount} curated news items across ${manifest.years.length} year files (${manifest.source.mode})`)
