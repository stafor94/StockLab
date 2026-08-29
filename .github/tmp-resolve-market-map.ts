import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ASSET_CATALOG } from '../config/assets'
import { parseAssetPriceSeries } from '../src/data/schema'
import { normalizeKrxKindHistoricalResponse, parseKrxKindIssuerInfo } from '../src/data/ingestion/krxKindHistorical'
import { normalizeNasdaqHistoricalPayload } from '../src/data/ingestion/nasdaqHistorical'
import { classifySplitAdjustment, unadjustSplitPrices, type EffectiveSplit } from '../src/data/ingestion/unadjustSplitPrices'
import type { DailyBar } from '../src/types/market'
import { readJson } from '../scripts/data/io'
import { fetchKrxKindHistoricalResponse, fetchKrxKindIssuerLookup, openKrxKindSession } from '../scripts/data/providers/krx-kind'
import { fetchNasdaqHistoricalPayload } from '../scripts/data/providers/nasdaq'
import { VERIFIED_US_SPLIT_EVENTS } from '../scripts/data/us-split-events'

interface PrivateSourceCandidate {
  provider: 'KRX' | 'NASDAQ'
  symbol: string
  assetClass?: 'stocks' | 'etf'
  candidates?: string[]
  [key: string]: unknown
}

interface PrivateSourceMapFile {
  schemaVersion: 1
  assets: Record<string, PrivateSourceCandidate>
}

const ROOT = process.cwd()
const SOURCE_MAP_PATH = join(ROOT, '.private', 'market-source-map.json')
const CACHE_ROOT = join(ROOT, '.cache', 'market-data')

function barsEqual(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date && left.open === right.open && left.high === right.high
    && left.low === right.low && left.close === right.close && left.volume === right.volume
}

async function krxCandidateMatches(assetId: string, symbol: string): Promise<boolean> {
  const asset = ASSET_CATALOG.find((item) => item.id === assetId)
  if (!asset || asset.market !== 'KR') return false
  const existing = parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath)))
  const samples = [existing.bars[0], existing.bars[Math.floor((existing.bars.length - 1) / 2)]]
  try {
    const xml = await fetchKrxKindIssuerLookup(symbol, { cacheRoot: CACHE_ROOT, force: true, delayMs: 80 })
    const issuer = parseKrxKindIssuerInfo(xml, symbol)
    const session = await openKrxKindSession(issuer.issuerCode, 80)
    for (const expected of samples) {
      const response = await fetchKrxKindHistoricalResponse({
        symbol,
        issuerCode: issuer.issuerCode,
        from: expected.date,
        to: expected.date,
        session,
        cacheRoot: CACHE_ROOT,
        force: true,
        delayMs: 80,
      })
      const actual = normalizeKrxKindHistoricalResponse(response, { from: expected.date, to: expected.date })[0]
      if (!actual || !barsEqual(actual, expected)) return false
    }
    return true
  } catch {
    return false
  }
}

async function nasdaqCandidateMatches(assetId: string, symbol: string): Promise<boolean> {
  const asset = ASSET_CATALOG.find((item) => item.id === assetId)
  if (!asset || asset.market !== 'US' || asset.kind !== 'stock') return false
  const existing = parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath)))
  const from = existing.bars[0].date
  const to = existing.bars.at(-1)!.date
  try {
    const payload = await fetchNasdaqHistoricalPayload({
      symbol,
      assetClass: 'stocks',
      from,
      to,
      limit: 5000,
      cacheRoot: CACHE_ROOT,
      force: true,
      delayMs: 80,
    })
    const adjusted = normalizeNasdaqHistoricalPayload(payload, { from, to })
    const adjustedSplits: EffectiveSplit[] = []
    for (const event of VERIFIED_US_SPLIT_EVENTS.filter((item) => item.assetId === assetId && item.effectiveDate >= from && item.effectiveDate <= to)) {
      const split = { effectiveDate: event.effectiveDate, numerator: event.numerator, denominator: event.denominator }
      const state = classifySplitAdjustment(adjusted, split)
      if (state === 'ambiguous') return false
      if (state === 'adjusted') adjustedSplits.push(split)
    }
    const actual = unadjustSplitPrices(adjusted, adjustedSplits)
    return actual.length === existing.bars.length && actual.every((bar, index) => barsEqual(bar, existing.bars[index]))
  } catch {
    return false
  }
}

const sourceMap = JSON.parse(await readFile(SOURCE_MAP_PATH, 'utf8')) as PrivateSourceMapFile
for (const [assetId, source] of Object.entries(sourceMap.assets)) {
  if (source.provider === 'KRX') {
    const candidates = [...new Set(source.candidates?.length ? source.candidates : [source.symbol])]
    const matches: string[] = []
    for (const candidate of candidates) {
      if (await krxCandidateMatches(assetId, candidate)) matches.push(candidate)
    }
    if (matches.length !== 1) throw new Error(`${assetId}: official KRX identity resolution did not produce exactly one price identity`)
    source.symbol = matches[0]
    delete source.candidates
    continue
  }

  const candidates = [...new Set(source.candidates ?? [])]
  if (candidates.length === 0) continue
  const matches: string[] = []
  for (const candidate of candidates) {
    if (await nasdaqCandidateMatches(assetId, candidate)) matches.push(candidate)
  }
  if (matches.length !== 1) throw new Error(`${assetId}: official Nasdaq candidate resolution did not produce exactly one price identity`)
  source.symbol = matches[0]
  delete source.candidates
  console.log(`Resolved encrypted private candidate for ${assetId}`)
}
await writeFile(SOURCE_MAP_PATH, `${JSON.stringify(sourceMap, null, 2)}\n`, { mode: 0o600 })
