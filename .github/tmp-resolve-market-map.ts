import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ASSET_CATALOG, type CatalogAsset } from '../config/assets'
import { parseAssetPriceSeries } from '../src/data/schema'
import { normalizeKrxKindHistoricalResponse, parseKrxKindIssuerInfo } from '../src/data/ingestion/krxKindHistorical'
import { normalizeNasdaqHistoricalPayload } from '../src/data/ingestion/nasdaqHistorical'
import { classifySplitAdjustment, unadjustSplitPrices, type EffectiveSplit } from '../src/data/ingestion/unadjustSplitPrices'
import type { AssetPriceSeries, DailyBar } from '../src/types/market'
import { readJson } from '../scripts/data/io'
import {
  fetchKrxKindHistoricalResponse,
  fetchKrxKindIssuerLookup,
  openKrxKindSession,
  type KrxKindSession,
} from '../scripts/data/providers/krx-kind'
import { fetchNasdaqHistoricalPayload } from '../scripts/data/providers/nasdaq'
import { VERIFIED_US_SPLIT_EVENTS } from '../scripts/data/us-split-events'

interface PrivateSourceCandidate {
  provider: 'KRX' | 'NASDAQ'
  symbol: string
  assetClass?: 'stocks' | 'etf'
  endpoint?: 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd'
  endpointChanges?: Array<{
    effectiveFrom: string
    endpoint: 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd'
  }>
  candidates?: string[]
  [key: string]: unknown
}

interface PrivateSourceMapFile {
  schemaVersion: 1
  assets: Record<string, PrivateSourceCandidate>
}

interface KrxUniverseEntry {
  symbol: string
  endpoint: 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd'
}

interface NasdaqScreenerRow {
  symbol?: unknown
  lastsale?: unknown
  ipoyear?: unknown
}

interface AssetIdentityContext {
  asset: CatalogAsset
  prices: AssetPriceSeries
}

const ROOT = process.cwd()
const SOURCE_MAP_PATH = join(ROOT, '.private', 'market-source-map.json')
const CACHE_ROOT = join(ROOT, '.cache', 'market-data')
const KIND_URL = 'https://kind.krx.co.kr/corpgeneral/listedissuestatusdetail.do'
const KIND_REFERER = 'https://kind.krx.co.kr/corpgeneral/listedIssueStatus.do?method=loadInitPage'
const NASDAQ_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  referer: 'https://www.nasdaq.com/market-activity/stocks/screener',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

const krxUniverseCache = new Map<string, KrxUniverseEntry[]>()
const krxIssuerCache = new Map<string, { issuerCode: string; session: KrxKindSession } | null>()
const krxSampleCache = new Map<string, DailyBar | null>()
const nasdaqOneDayCache = new Map<string, DailyBar | null>()

function barsPriceEqual(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date
    && left.open === right.open
    && left.high === right.high
    && left.low === right.low
    && left.close === right.close
}

function roundPrice(value: number): number {
  return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000
}

function shortCodeFromSecurityCode(value: string): string | null {
  const trimmed = value.trim()
  if (/^\d{6}$/.test(trimmed)) return trimmed
  return trimmed.match(/^KR7(\d{6})\d{3}$/)?.[1] ?? null
}

function cellText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseKrxUniverseHtml(
  html: string,
  endpoint: KrxUniverseEntry['endpoint'],
): KrxUniverseEntry[] {
  const headers = [...html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => cellText(match[1]))
  const codeIndex = headers.indexOf('종목코드')
  if (codeIndex < 0) throw new Error('KRX KIND universe response is not the security-level detail table')
  const result = new Map<string, KrxUniverseEntry>()
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cellText(match[1]))
    if (cells.length <= codeIndex) continue
    const symbol = shortCodeFromSecurityCode(cells[codeIndex])
    if (symbol) result.set(symbol, { symbol, endpoint })
  }
  return [...result.values()]
}

async function fetchKrxUniverse(date: string, kind: 'stock' | 'etf'): Promise<KrxUniverseEntry[]> {
  const key = `${kind}:${date}`
  const cached = krxUniverseCache.get(key)
  if (cached) return cached
  const endpoints: KrxUniverseEntry['endpoint'][] = kind === 'etf'
    ? ['etf_bydd_trd']
    : ['stk_bydd_trd', 'ksq_bydd_trd']
  const result: KrxUniverseEntry[] = []
  for (const endpoint of endpoints) {
    const form = endpoint === 'ksq_bydd_trd'
      ? { mktId: 'KSQ', secugrpId: 'ST' }
      : endpoint === 'etf_bydd_trd'
        ? { mktId: 'STK', secugrpId: 'EF' }
        : { mktId: 'STK', secugrpId: 'ST' }
    const body = new URLSearchParams({
      method: 'searchListedIssueStatDetailSub',
      forward: 'listedissuestatdetail_down',
      currentPageSize: '3000',
      pageIndex: '1',
      mktId: form.mktId,
      secugrpId: form.secugrpId,
      detailType: '2',
      selDate: date.replaceAll('-', ''),
    })
    let html: string | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await fetch(KIND_URL, {
          method: 'POST',
          body,
          headers: {
            Accept: 'text/html,*/*',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Referer: KIND_REFERER,
            'User-Agent': 'StockLab private identity resolver',
          },
          signal: AbortSignal.timeout(30_000),
        })
        if (response.ok) {
          html = new TextDecoder('euc-kr').decode(await response.arrayBuffer())
          break
        }
      } catch {
        // Retry without exposing private identity values.
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)))
    }
    if (html === null) throw new Error(`KRX KIND universe unavailable for ${kind} ${date}`)
    result.push(...parseKrxUniverseHtml(html, endpoint))
  }
  const unique = new Map<string, KrxUniverseEntry>()
  for (const entry of result) unique.set(entry.symbol, entry)
  const rows = [...unique.values()]
  krxUniverseCache.set(key, rows)
  return rows
}

async function getKrxIssuer(symbol: string): Promise<{ issuerCode: string; session: KrxKindSession } | null> {
  if (krxIssuerCache.has(symbol)) return krxIssuerCache.get(symbol) ?? null
  try {
    const xml = await fetchKrxKindIssuerLookup(symbol, {
      cacheRoot: CACHE_ROOT,
      force: false,
      delayMs: 15,
    })
    const issuer = parseKrxKindIssuerInfo(xml, symbol)
    const session = await openKrxKindSession(issuer.issuerCode, 15)
    const value = { issuerCode: issuer.issuerCode, session }
    krxIssuerCache.set(symbol, value)
    return value
  } catch {
    krxIssuerCache.set(symbol, null)
    return null
  }
}

async function fetchKrxSample(symbol: string, date: string): Promise<DailyBar | null> {
  const key = `${symbol}:${date}`
  if (krxSampleCache.has(key)) return krxSampleCache.get(key) ?? null
  const issuer = await getKrxIssuer(symbol)
  if (!issuer) {
    krxSampleCache.set(key, null)
    return null
  }
  try {
    const response = await fetchKrxKindHistoricalResponse({
      symbol,
      issuerCode: issuer.issuerCode,
      from: date,
      to: date,
      session: issuer.session,
      cacheRoot: CACHE_ROOT,
      force: false,
      delayMs: 15,
    })
    const bar = normalizeKrxKindHistoricalResponse(response, { from: date, to: date })[0] ?? null
    krxSampleCache.set(key, bar)
    return bar
  } catch {
    krxSampleCache.set(key, null)
    return null
  }
}

async function mapLimit<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await fn(items[index])
    }
  })
  await Promise.all(workers)
}

async function resolveKrxGroup(
  contexts: AssetIdentityContext[],
  sourceMap: PrivateSourceMapFile,
): Promise<void> {
  const firstDate = contexts[0].prices.bars[0].date
  const kind = contexts[0].asset.kind
  const universe = await fetchKrxUniverse(firstDate, kind)
  console.log(`KRX official universe scan for ${kind} ${firstDate}: ${universe.length} candidates`)
  const matches = new Map(contexts.map((context) => [context.asset.id, [] as KrxUniverseEntry[]]))
  await mapLimit(universe, 6, async (entry) => {
    const actual = await fetchKrxSample(entry.symbol, firstDate)
    if (!actual) return
    for (const context of contexts) {
      if (barsPriceEqual(actual, context.prices.bars[0])) matches.get(context.asset.id)!.push(entry)
    }
  })

  for (const context of contexts) {
    let candidates = matches.get(context.asset.id) ?? []
    if (candidates.length > 1) {
      const sampleIndexes = [
        Math.floor((context.prices.bars.length - 1) / 2),
        Math.max(0, context.prices.bars.length - 20),
      ]
      for (const sampleIndex of sampleIndexes) {
        if (candidates.length <= 1) break
        const expected = context.prices.bars[sampleIndex]
        const filtered: KrxUniverseEntry[] = []
        await mapLimit(candidates, 4, async (candidate) => {
          const actual = await fetchKrxSample(candidate.symbol, expected.date)
          if (actual && barsPriceEqual(actual, expected)) filtered.push(candidate)
        })
        candidates = filtered
      }
    }
    if (candidates.length !== 1) {
      throw new Error(`${context.asset.id}: official KRX universe resolution produced ${candidates.length} price identities`)
    }
    const resolved = candidates[0]
    const source = sourceMap.assets[context.asset.id]
    source.provider = 'KRX'
    source.symbol = resolved.symbol
    source.endpoint = resolved.endpoint
    source.endpointChanges = []
    delete source.candidates
    console.log(`Resolved official KRX private identity for ${context.asset.id}`)
  }
}

async function krxVenueOnDate(
  symbol: string,
  date: string,
): Promise<'stk_bydd_trd' | 'ksq_bydd_trd' | null> {
  const universe = await fetchKrxUniverse(date, 'stock')
  const entry = universe.find((item) => item.symbol === symbol)
  return entry?.endpoint === 'stk_bydd_trd' || entry?.endpoint === 'ksq_bydd_trd'
    ? entry.endpoint
    : null
}

async function resolveKrxVenueChanges(
  context: AssetIdentityContext,
  source: PrivateSourceCandidate,
): Promise<void> {
  if (context.asset.kind !== 'stock') return
  const initial = source.endpoint
  if (initial !== 'stk_bydd_trd' && initial !== 'ksq_bydd_trd') return
  const bars = context.prices.bars
  const finalVenue = await krxVenueOnDate(source.symbol, bars.at(-1)!.date)
  if (!finalVenue || finalVenue === initial) return
  let lo = 0
  let hi = bars.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const venue = await krxVenueOnDate(source.symbol, bars[mid].date)
    if (venue === finalVenue) hi = mid
    else lo = mid + 1
  }
  source.endpointChanges = [{ effectiveFrom: bars[lo].date, endpoint: finalVenue }]
  console.log(`Resolved official KRX venue transition for ${context.asset.id}`)
}

function parseDollar(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parsed = Number(String(value).replace(/[$,]/g, '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseIpoYear(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null
}

async function fetchNasdaqUniverse(): Promise<NasdaqScreenerRow[]> {
  const url = new URL('https://api.nasdaq.com/api/screener/stocks')
  url.searchParams.set('tableonly', 'true')
  url.searchParams.set('limit', '10000')
  url.searchParams.set('offset', '0')
  url.searchParams.set('download', 'true')
  let lastStatus = 0
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: NASDAQ_HEADERS,
        signal: AbortSignal.timeout(30_000),
      })
      lastStatus = response.status
      if (response.ok) {
        const payload = await response.json() as { data?: { rows?: NasdaqScreenerRow[] } }
        if (Array.isArray(payload.data?.rows)) return payload.data.rows
      }
    } catch {
      // Retry without exposing candidate values.
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)))
  }
  throw new Error(`Nasdaq official screener universe unavailable (status ${lastStatus || 'network'})`)
}

async function fetchNasdaqOneDay(symbol: string, date: string): Promise<DailyBar | null> {
  const key = `${symbol}:${date}`
  if (nasdaqOneDayCache.has(key)) return nasdaqOneDayCache.get(key) ?? null
  try {
    const payload = await fetchNasdaqHistoricalPayload({
      symbol,
      assetClass: 'stocks',
      from: date,
      to: date,
      limit: 10,
      cacheRoot: CACHE_ROOT,
      force: false,
      delayMs: 10,
    })
    const bar = normalizeNasdaqHistoricalPayload(payload, { from: date, to: date })[0] ?? null
    nasdaqOneDayCache.set(key, bar)
    return bar
  } catch {
    nasdaqOneDayCache.set(key, null)
    return null
  }
}

function fullyUnadjustedCandidateBar(assetId: string, bar: DailyBar): DailyBar {
  let factor = 1
  for (const event of VERIFIED_US_SPLIT_EVENTS) {
    if (event.assetId !== assetId || event.effectiveDate <= bar.date) continue
    factor *= event.numerator / event.denominator
  }
  if (Math.abs(factor - 1) < 1e-12) return bar
  return {
    ...bar,
    open: roundPrice(bar.open * factor),
    high: roundPrice(bar.high * factor),
    low: roundPrice(bar.low * factor),
    close: roundPrice(bar.close * factor),
  }
}

async function nasdaqCandidateMatches(
  assetId: string,
  symbol: string,
  existing: AssetPriceSeries,
): Promise<boolean> {
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
      force: false,
      delayMs: 15,
    })
    const adjusted = normalizeNasdaqHistoricalPayload(payload, { from, to })
    const adjustedSplits: EffectiveSplit[] = []
    for (const event of VERIFIED_US_SPLIT_EVENTS.filter(
      (item) => item.assetId === assetId && item.effectiveDate >= from && item.effectiveDate <= to,
    )) {
      const split = {
        effectiveDate: event.effectiveDate,
        numerator: event.numerator,
        denominator: event.denominator,
      }
      const state = classifySplitAdjustment(adjusted, split)
      if (state === 'ambiguous') return false
      if (state === 'adjusted') adjustedSplits.push(split)
    }
    const actual = unadjustSplitPrices(adjusted, adjustedSplits)
    return actual.length === existing.bars.length
      && actual.every((bar, index) => barsPriceEqual(bar, existing.bars[index]))
  } catch {
    return false
  }
}

async function resolveNasdaqGroup(
  contexts: AssetIdentityContext[],
  screenerRows: NasdaqScreenerRow[],
  sourceMap: PrivateSourceMapFile,
): Promise<void> {
  const firstDate = contexts[0].prices.bars[0].date
  const firstYear = Number(firstDate.slice(0, 4))
  const latestTargets = contexts.map((context) => context.prices.bars.at(-1)!.close)
  const candidates = screenerRows.flatMap((row) => {
    const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : ''
    if (!symbol || symbol.length > 12 || !/^[A-Z0-9./-]+$/i.test(symbol)) return []
    const ipoYear = parseIpoYear(row.ipoyear)
    if (ipoYear !== null && ipoYear > firstYear) return []
    const lastSale = parseDollar(row.lastsale)
    if (
      lastSale !== null
      && !latestTargets.some((target) => lastSale >= target / 3.5 && lastSale <= target * 3.5)
    ) return []
    return [symbol]
  })
  console.log(`Nasdaq official universe scan for ${firstDate}: ${candidates.length} candidates`)
  const matches = new Map(contexts.map((context) => [context.asset.id, [] as string[]]))
  await mapLimit(candidates, 8, async (symbol) => {
    const adjusted = await fetchNasdaqOneDay(symbol, firstDate)
    if (!adjusted) return
    for (const context of contexts) {
      const rawMatch = barsPriceEqual(adjusted, context.prices.bars[0])
      const restoredMatch = barsPriceEqual(
        fullyUnadjustedCandidateBar(context.asset.id, adjusted),
        context.prices.bars[0],
      )
      if (rawMatch || restoredMatch) matches.get(context.asset.id)!.push(symbol)
    }
  })

  for (const context of contexts) {
    const shortlist = [...new Set(matches.get(context.asset.id) ?? [])]
    const verified: string[] = []
    for (const symbol of shortlist) {
      if (await nasdaqCandidateMatches(context.asset.id, symbol, context.prices)) verified.push(symbol)
    }
    if (verified.length !== 1) {
      throw new Error(
        `${context.asset.id}: official Nasdaq universe resolution produced ${verified.length} full-history price identities from ${shortlist.length} shortlist candidates`,
      )
    }
    const source = sourceMap.assets[context.asset.id]
    source.provider = 'NASDAQ'
    source.assetClass = 'stocks'
    source.symbol = verified[0]
    delete source.candidates
    console.log(`Resolved official Nasdaq private identity for ${context.asset.id}`)
  }
}

async function loadContexts(filter: (asset: CatalogAsset) => boolean): Promise<AssetIdentityContext[]> {
  const result: AssetIdentityContext[] = []
  for (const asset of ASSET_CATALOG.filter(filter)) {
    result.push({
      asset,
      prices: parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath))),
    })
  }
  return result
}

function groupByFirstDateAndKind(contexts: AssetIdentityContext[]): AssetIdentityContext[][] {
  const groups = new Map<string, AssetIdentityContext[]>()
  for (const context of contexts) {
    const key = `${context.asset.kind}:${context.prices.bars[0].date}`
    const list = groups.get(key) ?? []
    list.push(context)
    groups.set(key, list)
  }
  return [...groups.values()]
}

const sourceMap = JSON.parse(await readFile(SOURCE_MAP_PATH, 'utf8')) as PrivateSourceMapFile
if (sourceMap.schemaVersion !== 1) throw new Error('Private source map schema mismatch')

const krContexts = await loadContexts((asset) => asset.market === 'KR')
for (const group of groupByFirstDateAndKind(krContexts)) await resolveKrxGroup(group, sourceMap)
for (const context of krContexts) {
  await resolveKrxVenueChanges(context, sourceMap.assets[context.asset.id])
}

const usContexts = await loadContexts((asset) => asset.market === 'US' && asset.kind === 'stock')
const screenerRows = await fetchNasdaqUniverse()
console.log(`Nasdaq official screener returned ${screenerRows.length} rows`)
for (const group of groupByFirstDateAndKind(usContexts)) {
  await resolveNasdaqGroup(group, screenerRows, sourceMap)
}

await writeFile(SOURCE_MAP_PATH, `${JSON.stringify(sourceMap, null, 2)}\n`, { mode: 0o600 })
console.log('Resolved exactly 97 supported private identities from official exchange data.')
