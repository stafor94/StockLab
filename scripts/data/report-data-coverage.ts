import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { parseCorporateEventDataset } from '../../src/data/corporateEventSchema'
import { parseNewsManifest, parseNewsYearDataset } from '../../src/data/newsSchema'
import { parseMarketCalendar, parseMarketDataManifest } from '../../src/data/schema'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const dataRoot = join(ROOT, 'public', 'data')
const strictMarket = process.argv.includes('--strict-market')

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

const manifest = parseMarketDataManifest(await json(join(dataRoot, 'manifest.json')))
const krCalendar = parseMarketCalendar(await json(join(dataRoot, manifest.calendars.KR)))
const usCalendar = parseMarketCalendar(await json(join(dataRoot, manifest.calendars.US)))
const corporate = parseCorporateEventDataset(await json(join(dataRoot, 'events', 'corporate.json')))
const newsManifest = parseNewsManifest(await json(join(dataRoot, 'news', 'manifest.json')))

let newsItems = 0
for (const year of newsManifest.years) {
  const dataset = parseNewsYearDataset(await json(join(dataRoot, 'news', year.path)))
  newsItems += dataset.items.length
}

const marketComplete = manifest.assets.length === ASSET_CATALOG.length
  && krCalendar.source.mode === 'generated'
  && usCalendar.source.mode === 'generated'

console.log('StockLab historical data coverage')
console.log(`- Market assets: ${manifest.assets.length}/${ASSET_CATALOG.length} (${marketComplete ? 'authoritative generated' : 'bootstrap/incomplete'})`)
console.log(`- KRX calendar: ${krCalendar.coverage.from}..${krCalendar.coverage.to} (${krCalendar.source.mode})`)
console.log(`- US calendar: ${usCalendar.coverage.from}..${usCalendar.coverage.to} (${usCalendar.source.mode})`)
console.log(`- Corporate actions: ${corporate.events.length} (${corporate.source.mode})`)
console.log(`- Curated news: ${newsItems} items / ${newsManifest.years.length} year files (${newsManifest.source.mode})`)

if (strictMarket && !marketComplete) {
  throw new Error(`Strict market coverage requires all ${ASSET_CATALOG.length} assets and generated KR/US calendars`)
}
