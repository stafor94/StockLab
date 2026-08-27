import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { applyMarketClosureDataset, assertCompleteMarketCalendar } from '../../src/data/ingestion/marketCalendarClosures'
import {
  normalizeKrxKindHistoricalResponse,
  parseKrxKindIssuerInfo,
} from '../../src/data/ingestion/krxKindHistorical'
import { parseMarketClosureDataset } from '../../src/data/schema'
import type {
  AssetManifestItem,
  AssetPriceSeries,
  DailyBar,
  MarketCalendar,
  MarketClosureDataset,
  MarketDataManifest,
} from '../../src/types/market'
import { isoDateInTimeZone } from './date'
import { readJson, writeJsonAtomic } from './io'
import {
  fetchKrxKindHistoricalResponse,
  fetchKrxKindIssuerLookup,
  openKrxKindSession,
} from './providers/krx-kind'
import { loadKoreanMarketSourceMap } from './source-map'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_FROM = '2018-01-01'
const KOREAN_TIME_ZONE = 'Asia/Seoul'
const KR_ASSETS = ASSET_CATALOG.filter((asset) => asset.market === 'KR')

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

function normalizeIdentityName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
}

function assertExpectedIdentity(assetId: string, expectedName: string | undefined, actualName: string): void {
  if (!expectedName) return
  if (normalizeIdentityName(expectedName) !== normalizeIdentityName(actualName)) {
    throw new Error(`${assetId} KRX KIND identity does not match the private expected name`)
  }
}

function yearlyRanges(from: string, to: string): Array<{ from: string; to: string }> {
  const ranges: Array<{ from: string; to: string }> = []
  const firstYear = Number(from.slice(0, 4))
  const lastYear = Number(to.slice(0, 4))
  for (let year = firstYear; year <= lastYear; year += 1) {
    ranges.push({
      from: year === firstYear ? from : `${year}-01-01`,
      to: year === lastYear ? to : `${year}-12-31`,
    })
  }
  return ranges
}

function effectiveListedFrom(asset: CatalogAsset, bars: DailyBar[]): string {
  return bars[0].date > asset.listedFrom ? bars[0].date : asset.listedFrom
}

function krCalendar(
  tradingDates: Set<string>,
  from: string,
  to: string,
  closureDataset: MarketClosureDataset,
): MarketCalendar {
  const dates = [...tradingDates].sort()
  if (dates.length === 0) {
    throw new Error(`KR calendar has no trading dates in ${from}..${to}`)
  }
  const calendar = applyMarketClosureDataset({
    schemaVersion: 1,
    market: 'KR',
    timeZone: KOREAN_TIME_ZONE,
    coverage: { from, to },
    tradingDates: dates,
    closures: [],
    source: {
      authoritativeProvider: 'KRX KIND',
      mode: 'generated',
      generatedAt: new Date().toISOString(),
    },
  }, closureDataset)
  assertCompleteMarketCalendar(calendar)
  return calendar
}

function marketManifest(value: unknown): MarketDataManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Existing market manifest must be an object')
  }
  const manifest = value as Partial<MarketDataManifest>
  if (manifest.schemaVersion !== 1 || !manifest.calendars || !Array.isArray(manifest.assets)) {
    throw new Error('Existing market manifest has an unsupported schema')
  }
  return manifest as MarketDataManifest
}

async function main(): Promise<void> {
  const from = assertIsoDate(cliValue('from') ?? process.env.MARKET_DATA_FROM ?? DEFAULT_FROM, 'from')
  const to = assertIsoDate(
    cliValue('to') ?? process.env.MARKET_DATA_TO ?? isoDateInTimeZone(new Date(), KOREAN_TIME_ZONE),
    'to',
  )
  if (from > to) throw new Error('from must not be after to')

  const force = process.argv.includes('--force')
  const sourceMapPath = process.env.MARKET_SOURCE_MAP_PATH
    ?? join(ROOT, '.private', 'market-source-map.json')
  const sourceMap = await loadKoreanMarketSourceMap(sourceMapPath)
  const outputRoot = join(ROOT, 'public', 'data')
  const cacheRoot = join(ROOT, '.cache', 'market-data')
  const delayMs = envNumber('KRX_KIND_REQUEST_DELAY_MS', 120)
  const closureDataset = parseMarketClosureDataset(
    await readJson(join(outputRoot, 'calendars', 'kr-closures.json')),
  )

  const missing = KR_ASSETS.filter((asset) => !sourceMap.has(asset.id))
  if (missing.length > 0) {
    throw new Error(`Private source map is missing ${missing.length} Korean assets: ${missing.map((asset) => asset.id).join(', ')}`)
  }

  const ranges = yearlyRanges(from, to)
  const tradingDates = new Set<string>()
  const manifestItems: AssetManifestItem[] = []

  for (const [index, asset] of KR_ASSETS.entries()) {
    const source = sourceMap.get(asset.id)
    if (!source) {
      throw new Error(`${asset.id} is missing from the Korean source map`)
    }

    console.log(`[${index + 1}/${KR_ASSETS.length}] Resolving ${asset.id}`)
    const issuerXml = await fetchKrxKindIssuerLookup(source.symbol, {
      cacheRoot,
      force,
      delayMs,
    })
    const issuer = parseKrxKindIssuerInfo(issuerXml, source.symbol)
    assertExpectedIdentity(asset.id, source.expectedName, issuer.name)
    const session = await openKrxKindSession(issuer.issuerCode, delayMs)
    const bars: DailyBar[] = []

    for (const range of ranges) {
      const responseText = await fetchKrxKindHistoricalResponse({
        symbol: source.symbol,
        issuerCode: issuer.issuerCode,
        from: range.from,
        to: range.to,
        session,
        cacheRoot,
        force,
        delayMs,
      })
      bars.push(...normalizeKrxKindHistoricalResponse(responseText, range))
    }

    bars.sort((left, right) => left.date.localeCompare(right.date))
    for (let barIndex = 1; barIndex < bars.length; barIndex += 1) {
      if (bars[barIndex - 1].date === bars[barIndex].date) {
        throw new Error(`${asset.id} has duplicate bar ${bars[barIndex].date}`)
      }
    }
    if (bars.length === 0) {
      throw new Error(`KRX KIND produced no bars for ${asset.id}`)
    }

    bars.forEach((bar) => tradingDates.add(bar.date))
    const series: AssetPriceSeries = {
      schemaVersion: 1,
      id: asset.id,
      market: 'KR',
      kind: asset.kind,
      currency: 'KRW',
      bars,
    }
    await writeJsonAtomic(join(outputRoot, asset.dataPath), series)
    manifestItems.push({
      id: asset.id,
      alias: asset.alias,
      kind: asset.kind,
      market: 'KR',
      currency: 'KRW',
      sector: asset.sector,
      listedFrom: effectiveListedFrom(asset, bars),
      dataPath: asset.dataPath,
    })
  }

  if (manifestItems.length !== KR_ASSETS.length) {
    throw new Error(`Expected ${KR_ASSETS.length} Korean assets but built ${manifestItems.length}`)
  }

  await writeJsonAtomic(
    join(outputRoot, 'calendars', 'kr.json'),
    krCalendar(tradingDates, from, to, closureDataset),
  )

  const existing = marketManifest(await readJson(join(outputRoot, 'manifest.json')))
  const byId = new Map(existing.assets.filter((asset) => asset.market !== 'KR').map((asset) => [asset.id, asset]))
  manifestItems.forEach((asset) => byId.set(asset.id, asset))
  const assets = ASSET_CATALOG.flatMap((asset) => {
    const manifestAsset = byId.get(asset.id)
    return manifestAsset ? [manifestAsset] : []
  })
  const manifest: MarketDataManifest = {
    schemaVersion: 1,
    calendars: existing.calendars,
    assets,
  }
  await writeJsonAtomic(join(outputRoot, 'manifest.json'), manifest)

  console.log(`Generated ${manifestItems.length} Korean asset series from official KRX KIND raw OHLCV.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
