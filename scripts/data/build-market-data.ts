import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import {
  normalizeAlphaVantageDailyPayload,
  normalizeKrxDailyPayload,
} from '../../src/data/ingestion/normalizers'
import type {
  AssetManifestItem,
  AssetPriceSeries,
  DailyBar,
  MarketCalendar,
  MarketDataManifest,
} from '../../src/types/market'
import { writeJsonAtomic } from './io'
import { fetchAlphaVantageDailyPayload } from './providers/alpha-vantage'
import { fetchKrxDailyPayload } from './providers/krx'
import {
  loadMarketSourceMap,
  type AssetSource,
  type KrxAssetSource,
  type KrxEndpoint,
} from './source-map'

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
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`)
  }
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
    if (weekday !== 0 && weekday !== 6) {
      result.push(cursor.toISOString().slice(0, 10))
    }
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
    const bucket = grouped.get(source.endpoint) ?? []
    bucket.push({ assetId, source })
    grouped.set(source.endpoint, bucket)
  }
  return grouped
}

function buildCalendar(
  market: 'KR' | 'US',
  tradingDates: Iterable<string>,
  from: string,
  to: string,
  generatedAt: string,
): MarketCalendar {
  const dates = [...new Set(tradingDates)].sort()
  if (dates.length === 0) {
    throw new Error(`${market} calendar has no trading dates in ${from}..${to}`)
  }
  return {
    schemaVersion: 1,
    market,
    timeZone: market === 'KR' ? 'Asia/Seoul' : 'America/New_York',
    coverage: { from, to },
    tradingDates: dates,
    closures: [],
    source: {
      authoritativeProvider: market === 'KR' ? 'KRX Open API' : 'Alpha Vantage',
      mode: 'generated',
      generatedAt,
    },
  }
}

function effectiveListedFrom(asset: CatalogAsset, bars: DailyBar[]): string {
  return bars[0].date > asset.listedFrom ? bars[0].date : asset.listedFrom
}

async function main(): Promise<void> {
  const from = assertIsoDate(cliValue('from') ?? process.env.MARKET_DATA_FROM ?? DEFAULT_FROM, 'from')
  const to = assertIsoDate(
    cliValue('to') ?? process.env.MARKET_DATA_TO ?? new Date().toISOString().slice(0, 10),
    'to',
  )
  if (from > to) {
    throw new Error('from must not be after to')
  }

  const allowPartial = process.argv.includes('--allow-partial')
  const force = process.argv.includes('--force')
  const sourceMapPath = process.env.MARKET_SOURCE_MAP_PATH
    ?? join(ROOT, '.private', 'market-source-map.json')
  const sourceMap = await loadMarketSourceMap(sourceMapPath, allowPartial)
  const outputRoot = join(ROOT, 'public', 'data')
  const cacheRoot = join(ROOT, '.cache', 'market-data')
  const krxAuthKey = process.env.KRX_AUTH_KEY
  const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY

  if (!krxAuthKey) {
    throw new Error('KRX_AUTH_KEY is required for authoritative Korean market data')
  }
  if (!alphaVantageApiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY is required for authoritative U.S. market data')
  }

  const krxDelayMs = envNumber('KRX_REQUEST_DELAY_MS', 150)
  const alphaDelayMs = envNumber('ALPHA_VANTAGE_REQUEST_DELAY_MS', 1200)
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
      if (endpoint === 'stk_bydd_trd' && rows.length > 0) {
        krTradingDates.add(date)
      }

      const rowsBySymbol = new Map(rows.map((row) => [row.symbol, row.bar]))
      for (const mapping of groupedKrxSources.get(endpoint) ?? []) {
        const bar = rowsBySymbol.get(mapping.source.symbol)
        if (!bar) continue
        const bucket = barsByAssetId.get(mapping.assetId) ?? []
        bucket.push(bar)
        barsByAssetId.set(mapping.assetId, bucket)
      }
    }
  }

  console.log(`Building Alpha Vantage data for ${from}..${to}`)
  for (const [assetId, source] of sourceMap.assets) {
    if (source.provider !== 'ALPHA_VANTAGE') continue
    const payload = await fetchAlphaVantageDailyPayload({
      symbol: source.symbol,
      apiKey: alphaVantageApiKey,
      cacheRoot,
      force,
      delayMs: alphaDelayMs,
    })
    const bars = normalizeAlphaVantageDailyPayload(payload, { from, to })
    barsByAssetId.set(assetId, bars)
  }

  const calendarProbeSymbol = process.env.US_CALENDAR_PROBE_SYMBOL ?? 'SPY'
  const probePayload = await fetchAlphaVantageDailyPayload({
    symbol: calendarProbeSymbol,
    apiKey: alphaVantageApiKey,
    cacheRoot,
    force,
    delayMs: alphaDelayMs,
  })
  const usCalendarBars = normalizeAlphaVantageDailyPayload(probePayload, { from, to })
  const generatedAt = new Date().toISOString()
  const krCalendar = buildCalendar('KR', krTradingDates, from, to, generatedAt)
  const usCalendar = buildCalendar(
    'US',
    usCalendarBars.map((bar) => bar.date),
    from,
    to,
    generatedAt,
  )

  const manifestAssets: AssetManifestItem[] = []
  for (const asset of ASSET_CATALOG) {
    const source = sourceMap.assets.get(asset.id)
    if (!source) continue
    const bars = [...(barsByAssetId.get(asset.id) ?? [])]
      .sort((left, right) => left.date.localeCompare(right.date))
    if (bars.length === 0) {
      throw new Error(`No price bars were produced for ${asset.id} (${asset.alias})`)
    }

    const listedFrom = effectiveListedFrom(asset, bars)
    const series: AssetPriceSeries = {
      schemaVersion: 1,
      id: asset.id,
      market: asset.market,
      kind: asset.kind,
      currency: asset.currency,
      bars,
    }
    await writeJsonAtomic(join(outputRoot, asset.dataPath), series)
    manifestAssets.push({
      id: asset.id,
      alias: asset.alias,
      kind: asset.kind,
      market: asset.market,
      currency: asset.currency,
      sector: asset.sector,
      listedFrom,
      dataPath: asset.dataPath,
    })
  }

  if (!allowPartial && manifestAssets.length !== ASSET_CATALOG.length) {
    throw new Error(`Expected ${ASSET_CATALOG.length} assets but built ${manifestAssets.length}`)
  }

  await writeJsonAtomic(join(outputRoot, 'calendars', 'kr.json'), krCalendar)
  await writeJsonAtomic(join(outputRoot, 'calendars', 'us.json'), usCalendar)

  const manifest: MarketDataManifest = {
    schemaVersion: 1,
    calendars: {
      KR: 'calendars/kr.json',
      US: 'calendars/us.json',
    },
    assets: manifestAssets,
  }
  // Manifest is written last so the runtime never points at half-generated files.
  await writeJsonAtomic(join(outputRoot, 'manifest.json'), manifest)

  console.log(`Generated ${manifestAssets.length} asset series with KRX/Alpha Vantage raw OHLCV.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
