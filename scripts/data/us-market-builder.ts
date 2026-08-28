import { join } from 'node:path'
import { ASSET_CATALOG, type CatalogAsset } from '../../config/assets'
import { parseCorporateEventDataset } from '../../src/data/corporateEventSchema'
import {
  normalizeNasdaqHistoricalPayload,
  nasdaqHistoricalTotalRecords,
} from '../../src/data/ingestion/nasdaqHistorical'
import {
  classifySplitAdjustment,
  unadjustSplitPrices,
  type EffectiveSplit,
} from '../../src/data/ingestion/unadjustSplitPrices'
import { parseMarketDataManifest } from '../../src/data/schema'
import type {
  AssetManifestItem,
  AssetPriceSeries,
  DailyBar,
  MarketCalendar,
  MarketDataManifest,
} from '../../src/types/market'
import { readJson, writeJsonAtomic } from './io'
import {
  US_SPLIT_REFERENCE,
  VERIFIED_US_SPLIT_EVENTS,
} from './us-split-events'
import {
  assertNasdaqInstrumentPayload,
  fetchNasdaqHistoricalPayload,
  fetchNasdaqInfoPayload,
} from './providers/nasdaq'
import { loadMarketSourceMap, type NasdaqAssetSource } from './source-map'

const US_ASSETS = ASSET_CATALOG.filter((asset) => asset.market === 'US')

export interface UsMarketBuildOptions {
  from: string
  to: string
  sourceMapPath: string
  outputRoot: string
  cacheRoot: string
  force: boolean
  requestDelayMs: number
}

export interface UsMarketBuildSummary {
  stockCount: number
  etfCount: number
  assetCount: number
  barCount: number
  earliestDate: string
  latestDate: string
  postCoverageStartListings: number
  splitRestorationAssetCount: number
  reverseSplitAssetCount: number
  splitEventCount: number
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function midpoint(from: string, to: string): string {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  return new Date(start + Math.floor((end - start) / 2)).toISOString().slice(0, 10)
}

function barsEqual(left: DailyBar, right: DailyBar): boolean {
  return left.date === right.date
    && left.open === right.open
    && left.high === right.high
    && left.low === right.low
    && left.close === right.close
    && left.volume === right.volume
}

function mergeBars(...groups: DailyBar[][]): DailyBar[] {
  const byDate = new Map<string, DailyBar>()
  for (const group of groups) {
    for (const bar of group) {
      const existing = byDate.get(bar.date)
      if (existing && !barsEqual(existing, bar)) {
        throw new Error(`Nasdaq returned conflicting duplicate bars for ${bar.date}`)
      }
      byDate.set(bar.date, bar)
    }
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

async function fetchCompleteHistory(
  source: NasdaqAssetSource,
  options: UsMarketBuildOptions,
  from: string,
  to: string,
): Promise<DailyBar[]> {
  const payload = await fetchNasdaqHistoricalPayload({
    symbol: source.symbol,
    assetClass: source.assetClass,
    from,
    to,
    limit: 5000,
    cacheRoot: options.cacheRoot,
    force: options.force,
    delayMs: options.requestDelayMs,
  })
  const bars = normalizeNasdaqHistoricalPayload(payload, { from, to })
  const totalRecords = nasdaqHistoricalTotalRecords(payload)
  if (totalRecords === null || totalRecords <= bars.length) return bars

  const pivot = midpoint(from, to)
  if (pivot <= from || pivot >= to) {
    throw new Error(`Nasdaq pagination could not resolve a private symbol for ${from}..${to}: ${bars.length}/${totalRecords}`)
  }
  const left = await fetchCompleteHistory(source, options, from, pivot)
  const right = await fetchCompleteHistory(source, options, addDays(pivot, 1), to)
  return mergeBars(left, right)
}

function assertUsSource(asset: CatalogAsset, source: unknown): asserts source is NasdaqAssetSource {
  if (!source || typeof source !== 'object' || (source as { provider?: string }).provider !== 'NASDAQ') {
    throw new Error(`Private source map must contain a NASDAQ mapping for ${asset.id}`)
  }
}

function verifiedSplitEventsByAsset(options: UsMarketBuildOptions): Map<string, EffectiveSplit[]> {
  const validAssetIds = new Set(US_ASSETS.map((asset) => asset.id))
  const splits = new Map<string, EffectiveSplit[]>()
  const seen = new Set<string>()

  for (const event of VERIFIED_US_SPLIT_EVENTS) {
    if (!validAssetIds.has(event.assetId)) throw new Error(`Verified split references unknown U.S. asset ${event.assetId}`)
    if (event.effectiveDate < options.from || event.effectiveDate > options.to) continue
    const key = `${event.assetId}:${event.effectiveDate}`
    if (seen.has(key)) throw new Error(`Duplicate verified U.S. split ${key}`)
    seen.add(key)
    const bucket = splits.get(event.assetId) ?? []
    bucket.push({
      effectiveDate: event.effectiveDate,
      numerator: event.numerator,
      denominator: event.denominator,
    })
    splits.set(event.assetId, bucket)
  }

  for (const bucket of splits.values()) {
    bucket.sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
  }
  return splits
}

function buildCalendar(tradingDates: string[], generatedAt: string): MarketCalendar {
  const dates = [...new Set(tradingDates)].sort()
  if (dates.length === 0) throw new Error('Nasdaq Historical Quotes produced no U.S. trading dates')
  return {
    schemaVersion: 1,
    market: 'US',
    timeZone: 'America/New_York',
    coverage: { from: dates[0], to: dates.at(-1)! },
    tradingDates: dates,
    closures: [],
    source: {
      authoritativeProvider: 'Nasdaq Historical Quotes',
      mode: 'generated',
      generatedAt,
    },
  }
}

function makeManifestItem(asset: CatalogAsset, bars: DailyBar[], marketCapPath?: string): AssetManifestItem {
  return {
    id: asset.id,
    alias: asset.alias,
    kind: asset.kind,
    market: asset.market,
    currency: asset.currency,
    sector: asset.sector,
    listedFrom: bars[0].date,
    dataPath: asset.dataPath,
    marketCapPath,
  }
}

async function updateCorporateSplitEvents(
  splitEventsByAsset: Map<string, EffectiveSplit[]>,
  generatedAt: string,
  latestDate: string,
  outputRoot: string,
): Promise<void> {
  const path = join(outputRoot, 'events', 'corporate.json')
  const current = parseCorporateEventDataset(await readJson(path))
  const usIds = new Set(US_ASSETS.map((asset) => asset.id))
  const retained = current.events.filter((event) => !(
    usIds.has(event.assetId)
    && (event.type === 'SPLIT' || event.type === 'REVERSE_SPLIT')
    && event.source.provider === 'Nasdaq / issuer-verified split history'
  ))
  const assetById = new Map(US_ASSETS.map((asset) => [asset.id, asset]))
  const generated = [...splitEventsByAsset.entries()].flatMap(([assetId, splits]) => {
    const asset = assetById.get(assetId)
    if (!asset) return []
    return splits.map((split) => {
      const type = split.numerator >= split.denominator ? 'SPLIT' as const : 'REVERSE_SPLIT' as const
      const ratio = `${split.numerator}:${split.denominator}`
      return {
        id: `CE-US-${assetId}-${split.effectiveDate.replaceAll('-', '')}`,
        assetId,
        date: split.effectiveDate,
        timing: 'PRE_OPEN' as const,
        type,
        title: `${asset.alias} ${type === 'SPLIT' ? '주식분할' : '주식병합'} ${ratio}`,
        summary: `보유 주식 수와 주당 평균매입가가 ${ratio} 비율의 corporate action에 맞게 조정됩니다.`,
        important: true,
        source: {
          provider: 'Nasdaq / issuer-verified split history',
          reference: US_SPLIT_REFERENCE,
        },
        payload: {
          numerator: split.numerator,
          denominator: split.denominator,
        },
      }
    })
  })

  await writeJsonAtomic(path, {
    schemaVersion: current.schemaVersion,
    coverage: {
      from: current.coverage.from < '2018-01-01' ? current.coverage.from : '2018-01-01',
      to: current.coverage.to > latestDate ? current.coverage.to : latestDate,
    },
    source: {
      mode: 'curated-partial',
      generatedAt,
    },
    events: [...retained, ...generated].sort((left, right) =>
      left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
    ),
  })
}

export async function buildAndPersistUsMarketData(
  options: UsMarketBuildOptions,
): Promise<UsMarketBuildSummary> {
  const sourceMap = await loadMarketSourceMap(options.sourceMapPath, true)
  const sourcesByAssetId = new Map<string, NasdaqAssetSource>()
  for (const asset of US_ASSETS) {
    const source = sourceMap.assets.get(asset.id)
    assertUsSource(asset, source)
    sourcesByAssetId.set(asset.id, source)
  }
  if (sourcesByAssetId.size !== 57) {
    throw new Error(`Expected 57 private U.S. mappings; found ${sourcesByAssetId.size}`)
  }

  const adjustedBarsByAsset = new Map<string, DailyBar[]>()
  const tradingDates = new Set<string>()
  for (const asset of US_ASSETS) {
    const source = sourcesByAssetId.get(asset.id)!
    const info = await fetchNasdaqInfoPayload({
      symbol: source.symbol,
      assetClass: source.assetClass,
      cacheRoot: options.cacheRoot,
      force: options.force,
      delayMs: options.requestDelayMs,
    })
    assertNasdaqInstrumentPayload(info, source.symbol)
    const bars = await fetchCompleteHistory(source, options, options.from, options.to)
    if (bars.length === 0) {
      throw new Error(`Nasdaq Historical Quotes returned no rows for ${asset.id}`)
    }
    adjustedBarsByAsset.set(asset.id, bars)
    for (const bar of bars) tradingDates.add(bar.date)
  }

  const splitEventsByAsset = verifiedSplitEventsByAsset(options)
  const restoredBarsByAsset = new Map<string, DailyBar[]>()
  const restorationAssets = new Set<string>()
  const reverseSplitAssets = new Set<string>()

  for (const asset of US_ASSETS) {
    const adjustedBars = adjustedBarsByAsset.get(asset.id)!
    const events = splitEventsByAsset.get(asset.id) ?? []
    const adjustedEvents: EffectiveSplit[] = []
    for (const event of events) {
      const state = classifySplitAdjustment(adjustedBars, event)
      if (state === 'ambiguous') {
        throw new Error(`Cannot safely determine Nasdaq split adjustment state for ${asset.id} on ${event.effectiveDate}`)
      }
      if (state === 'adjusted') {
        adjustedEvents.push(event)
        restorationAssets.add(asset.id)
      }
      if (event.numerator < event.denominator) reverseSplitAssets.add(asset.id)
    }
    restoredBarsByAsset.set(asset.id, unadjustSplitPrices(adjustedBars, adjustedEvents))
  }

  const generatedAt = new Date().toISOString()
  const calendar = buildCalendar([...tradingDates], generatedAt)
  const existingManifest = parseMarketDataManifest(await readJson(join(options.outputRoot, 'manifest.json')))
  const existingById = new Map(existingManifest.assets.map((item) => [item.id, item]))
  const manifestItems: AssetManifestItem[] = []

  for (const asset of US_ASSETS) {
    const bars = restoredBarsByAsset.get(asset.id)!
    const splitRestorationCount = (splitEventsByAsset.get(asset.id) ?? []).filter((event) =>
      classifySplitAdjustment(adjustedBarsByAsset.get(asset.id)!, event) === 'adjusted'
    ).length
    const series: AssetPriceSeries = {
      schemaVersion: 1,
      id: asset.id,
      market: 'US',
      kind: asset.kind,
      currency: 'USD',
      source: {
        authoritativeProvider: 'Nasdaq Historical Quotes',
        priceBasis: 'historical-unadjusted',
        splitAdjustmentPolicy: 'Detected split-adjusted Nasdaq rows are reversed with verified dated corporate-action ratios.',
        generatedAt,
        splitRestorationCount,
      },
      bars,
    }
    await writeJsonAtomic(join(options.outputRoot, asset.dataPath), series)
    manifestItems.push(makeManifestItem(asset, bars, existingById.get(asset.id)?.marketCapPath))
  }

  await writeJsonAtomic(join(options.outputRoot, 'calendars', 'us.json'), calendar)
  await updateCorporateSplitEvents(splitEventsByAsset, generatedAt, calendar.coverage.to, options.outputRoot)

  const existingKrAssets = existingManifest.assets.filter((item) => item.market === 'KR')
  const catalogOrder = new Map(ASSET_CATALOG.map((asset, index) => [asset.id, index]))
  const manifest: MarketDataManifest = {
    schemaVersion: existingManifest.schemaVersion,
    calendars: existingManifest.calendars,
    assets: [...existingKrAssets, ...manifestItems].sort((left, right) =>
      (catalogOrder.get(left.id) ?? 9999) - (catalogOrder.get(right.id) ?? 9999),
    ),
  }
  await writeJsonAtomic(join(options.outputRoot, 'manifest.json'), manifest)

  const allBars = [...restoredBarsByAsset.values()].flat()
  const firstTradingDate = calendar.tradingDates[0]
  return {
    stockCount: US_ASSETS.filter((asset) => asset.kind === 'stock').length,
    etfCount: US_ASSETS.filter((asset) => asset.kind === 'etf').length,
    assetCount: US_ASSETS.length,
    barCount: allBars.length,
    earliestDate: allBars.reduce((earliest, bar) => bar.date < earliest ? bar.date : earliest, allBars[0].date),
    latestDate: allBars.reduce((latest, bar) => bar.date > latest ? bar.date : latest, allBars[0].date),
    postCoverageStartListings: US_ASSETS.filter((asset) =>
      restoredBarsByAsset.get(asset.id)![0].date > firstTradingDate,
    ).length,
    splitRestorationAssetCount: restorationAssets.size,
    reverseSplitAssetCount: reverseSplitAssets.size,
    splitEventCount: [...splitEventsByAsset.values()].reduce((count, events) => count + events.length, 0),
  }
}
