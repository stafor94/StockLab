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

interface KrxDailyRow {
  ISU_SRT_CD?: unknown
  TDD_OPNPRC?: unknown
  TDD_HGPRC?: unknown
  TDD_LWPRC?: unknown
  TDD_CLSPRC?: unknown
}

const ROOT = process.cwd()
const SOURCE_MAP_PATH = join(ROOT, '.private', 'market-source-map.json')
const CACHE_ROOT = join(ROOT, '.cache', 'market-data')
const krxDailyRowsByDate = new Map<string, KrxDailyRow[]>()

function barsEqual(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date && left.open === right.open && left.high === right.high
    && left.low === right.low && left.close === right.close && left.volume === right.volume
}

function krxNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parsed = Number(String(value).replaceAll(',', '').trim())
  return Number.isFinite(parsed) ? parsed : null
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

async function fetchKrxDailyRows(date: string): Promise<KrxDailyRow[]> {
  const cached = krxDailyRowsByDate.get(date)
  if (cached) return cached
  const body = new URLSearchParams({
    bld: 'dbms/MDC/STAT/standard/MDCSTAT01501',
    locale: 'ko_KR',
    mktId: 'ALL',
    trdDd: date.replaceAll('-', ''),
    share: '1',
    money: '1',
    csvxls_isNo: 'false',
  })
  for (const endpoint of [
    'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd',
    'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd',
  ]) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201',
          'user-agent': 'Mozilla/5.0 StockLab market-cap identity verifier',
          'x-requested-with': 'XMLHttpRequest',
        },
        body,
      })
      if (!response.ok) continue
      const parsed = await response.json() as { OutBlock_1?: KrxDailyRow[] }
      if (Array.isArray(parsed.OutBlock_1)) {
        krxDailyRowsByDate.set(date, parsed.OutBlock_1)
        return parsed.OutBlock_1
      }
    } catch {
      // Try the next official KRX endpoint form.
    }
  }
  throw new Error('official KRX daily identity shortlist is unavailable')
}

async function fetchKrxDailyShortlist(assetId: string): Promise<string[]> {
  const asset = ASSET_CATALOG.find((item) => item.id === assetId)
  if (!asset || asset.market !== 'KR') return []
  const existing = parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath)))
  const expected = existing.bars[0]
  const rows = await fetchKrxDailyRows(expected.date)
  return [...new Set(rows.flatMap((row) => {
    const code = typeof row.ISU_SRT_CD === 'string' ? row.ISU_SRT_CD.trim() : ''
    if (!/^\d{6}$/.test(code)) return []
    if (krxNumber(row.TDD_OPNPRC) !== expected.open) return []
    if (krxNumber(row.TDD_HGPRC) !== expected.high) return []
    if (krxNumber(row.TDD_LWPRC) !== expected.low) return []
    if (krxNumber(row.TDD_CLSPRC) !== expected.close) return []
    return [code]
  }))]
}

async function resolveKrxSource(assetId: string, source: PrivateSourceCandidate): Promise<void> {
  const configuredCandidates = [...new Set(source.candidates ?? [])]
  const directCandidates = configuredCandidates.length > 0 ? configuredCandidates : [source.symbol]
  const directMatches: string[] = []
  for (const candidate of directCandidates) {
    if (await krxCandidateMatches(assetId, candidate)) directMatches.push(candidate)
  }
  if (directMatches.length === 1) {
    source.symbol = directMatches[0]
    delete source.candidates
    if (configuredCandidates.length > 0) console.log(`Resolved encrypted private candidate for ${assetId}`)
    return
  }

  const dailyCandidates = await fetchKrxDailyShortlist(assetId)
  const verified: string[] = []
  for (const candidate of dailyCandidates) {
    if (await krxCandidateMatches(assetId, candidate)) verified.push(candidate)
  }
  if (verified.length !== 1) throw new Error(`${assetId}: official KRX identity resolution did not produce exactly one price identity`)
  source.symbol = verified[0]
  delete source.candidates
  console.log(`Resolved official KRX private identity for ${assetId}`)
}

async function loadExistingUs(assetId: string): Promise<ReturnType<typeof parseAssetPriceSeries>> {
  const asset = ASSET_CATALOG.find((item) => item.id === assetId)
  if (!asset || asset.market !== 'US' || asset.kind !== 'stock') throw new Error(`${assetId}: expected U.S. stock`)
  return parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath)))
}

function adjustedNasdaqMatches(assetId: string, adjustedAll: DailyBar[], existing: ReturnType<typeof parseAssetPriceSeries>): boolean {
  const from = existing.bars[0].date
  const to = existing.bars.at(-1)!.date
  const adjusted = adjustedAll.filter((bar) => bar.date >= from && bar.date <= to)
  const adjustedSplits: EffectiveSplit[] = []
  for (const event of VERIFIED_US_SPLIT_EVENTS.filter((item) => item.assetId === assetId && item.effectiveDate >= from && item.effectiveDate <= to)) {
    const split = { effectiveDate: event.effectiveDate, numerator: event.numerator, denominator: event.denominator }
    const state = classifySplitAdjustment(adjusted, split)
    if (state === 'ambiguous') return false
    if (state === 'adjusted') adjustedSplits.push(split)
  }
  const actual = unadjustSplitPrices(adjusted, adjustedSplits)
  return actual.length === existing.bars.length && actual.every((bar, index) => barsEqual(bar, existing.bars[index]))
}

async function resolveNasdaqSources(sourceMap: PrivateSourceMapFile): Promise<void> {
  const sources = Object.entries(sourceMap.assets).filter(([, source]) => source.provider === 'NASDAQ')
  if (sources.length === 0) return
  const candidateUniverse = [...new Set(sources.flatMap(([, source]) => source.candidates ?? []))]
  if (candidateUniverse.length === 0) return
  const usAssets = ASSET_CATALOG.filter((asset) => asset.market === 'US' && asset.kind === 'stock')
  const existingById = new Map<string, Awaited<ReturnType<typeof loadExistingUs>>>()
  for (const asset of usAssets) existingById.set(asset.id, await loadExistingUs(asset.id))
  const globalFrom = [...existingById.values()].map((series) => series.bars[0].date).sort()[0]
  const globalTo = [...existingById.values()].map((series) => series.bars.at(-1)!.date).sort().at(-1)!
  const matchesById = new Map(usAssets.map((asset) => [asset.id, [] as string[]]))

  for (const candidate of candidateUniverse) {
    let adjusted: DailyBar[]
    try {
      const payload = await fetchNasdaqHistoricalPayload({
        symbol: candidate,
        assetClass: 'stocks',
        from: globalFrom,
        to: globalTo,
        limit: 5000,
        cacheRoot: CACHE_ROOT,
        force: true,
        delayMs: 80,
      })
      adjusted = normalizeNasdaqHistoricalPayload(payload, { from: globalFrom, to: globalTo })
    } catch {
      continue
    }
    for (const asset of usAssets) {
      if (adjustedNasdaqMatches(asset.id, adjusted, existingById.get(asset.id)!)) {
        matchesById.get(asset.id)!.push(candidate)
      }
    }
  }

  for (const asset of usAssets) {
    const matches = matchesById.get(asset.id)!
    if (matches.length !== 1) throw new Error(`${asset.id}: official Nasdaq identity resolution did not produce exactly one price identity`)
    const source = sourceMap.assets[asset.id]
    if (!source || source.provider !== 'NASDAQ') throw new Error(`${asset.id}: missing encrypted Nasdaq source slot`)
    source.symbol = matches[0]
    delete source.candidates
    console.log(`Resolved official Nasdaq private identity for ${asset.id}`)
  }
}

const sourceMap = JSON.parse(await readFile(SOURCE_MAP_PATH, 'utf8')) as PrivateSourceMapFile
for (const [assetId, source] of Object.entries(sourceMap.assets)) {
  if (source.provider === 'KRX') await resolveKrxSource(assetId, source)
}
await resolveNasdaqSources(sourceMap)
await writeFile(SOURCE_MAP_PATH, `${JSON.stringify(sourceMap, null, 2)}\n`, { mode: 0o600 })
