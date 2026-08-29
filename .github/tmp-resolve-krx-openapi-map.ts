import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ASSET_CATALOG, type CatalogAsset } from '../config/assets'
import { parseAssetPriceSeries } from '../src/data/schema'
import type { AssetPriceSeries, DailyBar } from '../src/types/market'
import { readJson } from '../scripts/data/io'

interface Source {
  provider: 'KRX' | 'NASDAQ'
  symbol: string
  endpoint?: 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd'
  endpointChanges?: Array<{ effectiveFrom: string; endpoint: 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd' }>
  [key: string]: unknown
}

interface SourceMapFile {
  schemaVersion: 1
  assets: Record<string, Source>
}

interface RawRow {
  [key: string]: unknown
}

interface MarketRow {
  symbol: string
  endpoint: 'stk_bydd_trd' | 'ksq_bydd_trd' | 'etf_bydd_trd'
  bar: DailyBar
}

interface Context {
  asset: CatalogAsset
  prices: AssetPriceSeries
}

const ROOT = process.cwd()
const SOURCE_MAP_PATH = join(ROOT, '.private', 'market-source-map.json')
const AUTH_KEY = process.env.KRX_OPEN_API_AUTH_KEY?.trim() ?? ''
if (!AUTH_KEY) throw new Error('KRX Open API credential was selected but is unavailable')

const API_ROOT = 'https://data-dbg.krx.co.kr/svc/apis'
const ENDPOINT_PATH = {
  stk_bydd_trd: 'sto/stk_bydd_trd',
  ksq_bydd_trd: 'sto/ksq_bydd_trd',
  etf_bydd_trd: 'etp/etf_bydd_trd',
} as const
const cache = new Map<string, MarketRow[]>()

function text(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const result = String(value).trim()
  return result ? result : null
}

function num(value: unknown): number | null {
  const raw = text(value)
  if (!raw) return null
  const parsed = Number(raw.replaceAll(',', ''))
  return Number.isFinite(parsed) ? parsed : null
}

function symbolOf(row: RawRow): string | null {
  for (const key of ['ISU_SRT_CD', 'ISU_CD']) {
    const raw = text(row[key])
    if (!raw) continue
    if (/^\d{1,6}$/.test(raw)) return raw.padStart(6, '0')
    const isin = raw.match(/^KR7(\d{6})\d{3}$/)
    if (isin) return isin[1]
  }
  return null
}

function dateOf(row: RawRow): string | null {
  const raw = text(row.BAS_DD)
  if (!raw || !/^\d{8}$/.test(raw)) return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

async function fetchRows(
  endpoint: MarketRow['endpoint'],
  date: string,
): Promise<MarketRow[]> {
  const key = `${endpoint}:${date}`
  const cached = cache.get(key)
  if (cached) return cached
  const url = new URL(`${API_ROOT}/${ENDPOINT_PATH[endpoint]}`)
  url.searchParams.set('basDd', date.replaceAll('-', ''))
  let payload: { OutBlock_1?: RawRow[] } | null = null
  let status = 0
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', AUTH_KEY },
        signal: AbortSignal.timeout(30_000),
      })
      status = response.status
      if (response.ok) {
        payload = await response.json() as { OutBlock_1?: RawRow[] }
        break
      }
      if (response.status !== 429 && response.status < 500) break
    } catch {
      // Retry without exposing any identity value.
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)))
  }
  if (!Array.isArray(payload?.OutBlock_1)) {
    throw new Error(`KRX Open API ${endpoint} ${date} unavailable (status ${status || 'network'})`)
  }
  const rows: MarketRow[] = []
  for (const raw of payload.OutBlock_1) {
    const symbol = symbolOf(raw)
    const rowDate = dateOf(raw)
    const open = num(raw.TDD_OPNPRC)
    const high = num(raw.TDD_HGPRC)
    const low = num(raw.TDD_LWPRC)
    const close = num(raw.TDD_CLSPRC)
    const volume = num(raw.ACC_TRDVOL) ?? 0
    if (!symbol || rowDate !== date || open === null || high === null || low === null || close === null) continue
    rows.push({
      symbol,
      endpoint,
      bar: { date, open, high, low, close, volume },
    })
  }
  cache.set(key, rows)
  return rows
}

function priceEqual(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date
    && left.open === right.open
    && left.high === right.high
    && left.low === right.low
    && left.close === right.close
}

async function rowsForContextDate(context: Context, date: string): Promise<MarketRow[]> {
  if (context.asset.kind === 'etf') return fetchRows('etf_bydd_trd', date)
  return [
    ...await fetchRows('stk_bydd_trd', date),
    ...await fetchRows('ksq_bydd_trd', date),
  ]
}

async function resolveContext(context: Context, sourceMap: SourceMapFile): Promise<void> {
  const first = context.prices.bars[0]
  let candidates = (await rowsForContextDate(context, first.date)).filter((row) => priceEqual(row.bar, first))
  const sampleIndexes = [
    Math.floor((context.prices.bars.length - 1) / 2),
    Math.max(0, context.prices.bars.length - 20),
  ]
  for (const index of sampleIndexes) {
    if (candidates.length <= 1) break
    const expected = context.prices.bars[index]
    const allowed = new Set(candidates.map((row) => row.symbol))
    candidates = (await rowsForContextDate(context, expected.date))
      .filter((row) => allowed.has(row.symbol) && priceEqual(row.bar, expected))
  }
  const uniqueSymbols = [...new Set(candidates.map((row) => row.symbol))]
  if (uniqueSymbols.length !== 1) {
    throw new Error(`${context.asset.id}: KRX Open API resolution produced ${uniqueSymbols.length} price identities`)
  }
  const symbol = uniqueSymbols[0]
  const initial = candidates.find((row) => row.symbol === symbol)?.endpoint
  if (!initial) throw new Error(`${context.asset.id}: KRX Open API did not retain an initial market endpoint`)
  const source = sourceMap.assets[context.asset.id]
  source.provider = 'KRX'
  source.symbol = symbol
  source.endpoint = initial
  source.endpointChanges = []

  if (context.asset.kind === 'stock') {
    const bars = context.prices.bars
    const finalDate = bars.at(-1)!.date
    const finalRows = await rowsForContextDate(context, finalDate)
    const finalEndpoint = finalRows.find((row) => row.symbol === symbol)?.endpoint
    if (finalEndpoint && finalEndpoint !== initial) {
      let lo = 0
      let hi = bars.length - 1
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2)
        const midRows = await rowsForContextDate(context, bars[mid].date)
        const endpoint = midRows.find((row) => row.symbol === symbol)?.endpoint
        if (endpoint === finalEndpoint) hi = mid
        else lo = mid + 1
      }
      source.endpointChanges = [{ effectiveFrom: bars[lo].date, endpoint: finalEndpoint }]
    }
  }
  console.log(`Resolved official KRX Open API private identity for ${context.asset.id}`)
}

const sourceMap = JSON.parse(await readFile(SOURCE_MAP_PATH, 'utf8')) as SourceMapFile
const contexts: Context[] = []
for (const asset of ASSET_CATALOG.filter((item) => item.market === 'KR')) {
  contexts.push({
    asset,
    prices: parseAssetPriceSeries(await readJson(join(ROOT, 'public', 'data', asset.dataPath))),
  })
}
for (const context of contexts) await resolveContext(context, sourceMap)
await writeFile(SOURCE_MAP_PATH, `${JSON.stringify(sourceMap, null, 2)}\n`, { mode: 0o600 })
console.log(`Resolved ${contexts.length} Korean private identities from KRX Open API.`)
