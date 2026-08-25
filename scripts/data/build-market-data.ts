import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { normalizeKrxDailyPayload } from '../../src/data/ingestion/normalizers'
import { parseMarketDataManifest } from '../../src/data/schema'
import type {
  AssetManifestItem,
  AssetPriceSeries,
  DailyBar,
  MarketCalendar,
  MarketDataManifest,
} from '../../src/types/market'
import { readJson, writeJsonAtomic } from './io'
import { fetchKrxDailyPayload } from './providers/krx'
import {
  getKrxEndpointForDate,
  getKrxSourceEndpoints,
  loadMarketSourceMap,
  type AssetSource,
  type KrxAssetSource,
  type KrxEndpoint,
} from './source-map'
import { buildAndPersistUsMarketData } from './us-market-builder'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_FROM = '2018-01-01'

function cliValue(name: string): string | null {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : null
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`)
  return value
}

function assertIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must use YYYY-MM-DD`)
  }
  return value
}

function enumerateWeekdays(from: string, to: string): string[] {
  const result: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) result.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

function groupKrxSources(
  sources: Map<string, AssetSource>,
): Map<KrxEndpoint, Array<{ assetId: string; source: KrxAssetSource }>> {
  const grouped = new Map<KrxEndpoint, Array<{ assetId: string; source: KrxAssetSource }>>()
  for (const [assetId, source] of sources) {
    if (source.provider !== 'KRX') continue
    for (const endpoint of getKrxSourceEndpoints(source)) {
      const bucket = grouped.get(endpoint) ?? []
      bucket.push({ assetId, source })
      grouped.set(endpoint, bucket)
    }
  }
  return grouped
}

function buildKrCalendar(
  tradingDates: Iterable<string>,
  generatedAt: string,
): MarketCalendar {
  const dates = [...new Set(tradingDates)].sort()
  if (dates.length === 0) throw new Error('KR calendar has no authoritative trading dates')
  return {
    schemaVersion: 1,
    market: 'KR',
    timeZone: 'Asia/Seoul',
    coverage: { from: dates[0], to: dates.at(-1)! },
    tradingDates: dates,
    closures: [],
    source: {
      authoritativeProvider: 'KRX Open API',
      mode: 'generated',
      generatedAt,
    },
  }
}

async function main(): Promise<void> {
  const from = assertIsoDate(cliValue('from') ?? process.env.MARKET_DATA_FROM ?? DEFAULT_FROM, 'from')
  const to = assertIsoDate(
    cliValue('to') ?? process.env.MARKET_DATA_TO ?? new Date().toISOString().slice(0, 10),
    'to',
  )
  if (from > to) throw new Error('from must not be after to')

  const allowPartial = process.argv.includes('--allow-partial')
  const force = process.argv.includes('--force')
  const sourceMapPath = process.env.MARKET_SOURCE_MAP_PATH ?? join(ROOT, '.private', 'market-source-map.json')
  const sourceMap = await loadMarketSourceMap(sourceMapPath, allowPartial)
  const outputRoot = join(ROOT, 'public', 'data')
  const cacheRoot = join(ROOT, '.cache', 'market-data')
  const krxAuthKey = process.env.KRX_AUTH_KEY
  if (!krxAuthKey) throw new Error('KRX_AUTH_KEY is required for authoritative Korean market data')

  const krxDelayMs = envNumber('KRX_REQUEST_DELAY_MS', 150)
  const barsByAssetId = new Map<string, DailyBar[]>()
  const krTradingDates = new Set<string>()
  const groupedKrxSources = groupKrxSources(sourceMap.assets)
  const krxEndpoints = new Set<KrxEndpoint>(['stk_bydd_trd', ...groupedKrxSources.keys()])

  console.log(`Building KRX data for ${from}..${to}`)
  for (const date of enumerateWeekdays(from, to)) {
    for (const endpoint of krxEndpoints) {
      const payload = await fetchKrxDailyPayload({
        endpoint,
        date,
        authKey: krxAuthKey,
        cacheRoot,
        force,
        delayMs: krxDelayMs,
      })
      const rows = normalizeKrxDailyPayload(payload)
      if (endpoint === 'stk_bydd_trd' && rows.length > 0) krTradingDates.add(date)
      const rowsBySymbol = new Map(rows.map((row) => [row.symbol, row.bar]))
      for (const mapping of groupedKrxSources.get(endpoint) ?? []) {
        if (getKrxEndpointForDate(mapping.source, date) !== endpoint) continue
        const bar = rowsBySymbol.get(mapping.source.symbol)
        if (!bar) continue
        const bucket = barsByAssetId.get(mapping.assetId) ?? []
        bucket.push(bar)
        barsByAssetId.set(mapping.assetId, bucket)
      }
    }
  }

  const generatedAt = new Date().toISOString()
  const krCalendar = buildKrCalendar(krTradingDates, generatedAt)
  const krManifestItems: AssetManifestItem[] = []
  for (const asset of ASSET_CATALOG.filter((item) => item.market === 'KR')) {
    const source = sourceMap.assets.get(asset.id)
    if (!source) {
      if (allowPartial) continue
      throw new Error(`source map is missing ${asset.id}`)
    }
    const bars = [...(barsByAssetId.get(asset.id) ?? [])].sort((left, right) => left.date.localeCompare(right.date))
    if (bars.length === 0) throw new Error(`No KRX price bars were produced for ${asset.id}`)
    const series: AssetPriceSeries = {
      schemaVersion: 1,
      id: asset.id,
      market: 'KR',
      kind: asset.kind,
      currency: 'KRW',
      bars,
    }
    await writeJsonAtomic(join(outputRoot, asset.dataPath), series)
    krManifestItems.push({
      id: asset.id,
      alias: asset.alias,
      kind: asset.kind,
      market: asset.market,
      currency: asset.currency,
      sector: asset.sector,
      listedFrom: bars[0].date,
      dataPath: asset.dataPath,
    })
  }

  if (!allowPartial && krManifestItems.length !== ASSET_CATALOG.filter((asset) => asset.market === 'KR').length) {
    throw new Error(`Expected complete KRX asset coverage; built ${krManifestItems.length}`)
  }

  await writeJsonAtomic(join(outputRoot, 'calendars', 'kr.json'), krCalendar)
  const existingManifest = parseMarketDataManifest(await readJson(join(outputRoot, 'manifest.json')))
  const krOnlyManifest: MarketDataManifest = {
    schemaVersion: existingManifest.schemaVersion,
    calendars: existingManifest.calendars,
    assets: krManifestItems,
  }
  await writeJsonAtomic(join(outputRoot, 'manifest.json'), krOnlyManifest)

  console.log(`Building Nasdaq Historical Quotes data for ${from}..${to}`)
  const usSummary = await buildAndPersistUsMarketData({
    from,
    to,
    sourceMapPath,
    outputRoot,
    cacheRoot,
    force,
    requestDelayMs: envNumber('NASDAQ_REQUEST_DELAY_MS', 80),
  })

  console.log(`Generated ${krManifestItems.length} KRX series and ${usSummary.assetCount} Nasdaq series.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
