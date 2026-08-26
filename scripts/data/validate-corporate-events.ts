import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_CATALOG } from '../../config/assets'
import { mergeCorporateEventDatasets, parseCorporateEventDataset } from '../../src/data/corporateEventSchema'
import { CORPORATE_EVENT_SHARD_FILES } from '../../src/data/corporateEventShards'
import { VERIFIED_US_SPLIT_EVENTS } from './us-split-events'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const corporatePaths = CORPORATE_EVENT_SHARD_FILES.map((file) => join(ROOT, 'public', 'data', 'events', file))
const manifestPath = join(ROOT, 'public', 'data', 'manifest.json')
const shardValues = await Promise.all(corporatePaths.map(async (path) => JSON.parse(await readFile(path, 'utf8')) as unknown))
const manifestValue = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  assets?: Array<{ id?: unknown; listedFrom?: unknown }>
}
const shards = shardValues.map(parseCorporateEventDataset)
const parsed = mergeCorporateEventDatasets(shards)
const knownAssets = new Set(ASSET_CATALOG.map((asset) => asset.id))
const manifestAssets = (manifestValue.assets ?? []).filter((asset): asset is { id: string; listedFrom: string } => typeof asset.id === 'string' && typeof asset.listedFrom === 'string')
const listedFromByAsset = new Map(manifestAssets.map((asset) => [asset.id, asset.listedFrom]))
const firstCoverageSession = manifestAssets.map((asset) => asset.listedFrom).sort()[0]
const forbiddenSourceHosts = ['finance.yahoo.com', 'stooq.com', 'investing.com', 'finance.naver.com']

if ((parsed.source.mode === 'generated' || parsed.source.mode === 'curated-partial') && parsed.events.length === 0) {
  throw new Error(`${parsed.source.mode} corporate event dataset is unexpectedly empty`)
}
if (manifestAssets.length !== ASSET_CATALOG.length) throw new Error(`Manifest/catalog asset count mismatch: ${manifestAssets.length} vs ${ASSET_CATALOG.length}`)
if (!firstCoverageSession) throw new Error('Manifest has no listedFrom dates')

for (let shardIndex = 0; shardIndex < shardValues.length; shardIndex += 1) {
  const rawEvents = (shardValues[shardIndex] as { events?: Array<{ id?: unknown }> }).events ?? []
  const rawOrder = rawEvents.map((event) => event.id)
  const sortedOrder = shards[shardIndex].events.map((event) => event.id)
  if (rawOrder.length !== sortedOrder.length || rawOrder.some((id, index) => id !== sortedOrder[index])) {
    throw new Error(`Corporate event shard ${corporatePaths[shardIndex]} must be stored in date/id sort order`)
  }
}

const assetDateTypeKeys = new Set<string>()
for (const event of parsed.events) {
  if (!knownAssets.has(event.assetId)) throw new Error(`Unknown corporate-event asset ${event.assetId} in ${event.id}`)
  if (event.date < parsed.coverage.from || event.date > parsed.coverage.to) {
    throw new Error(`Corporate event ${event.id} is outside dataset coverage`)
  }
  if (!event.source.reference.startsWith('https://')) {
    throw new Error(`Corporate event ${event.id} must use an HTTPS source reference`)
  }
  const sourceHost = new URL(event.source.reference).hostname.toLowerCase()
  if (forbiddenSourceHosts.some((host) => sourceHost === host || sourceHost.endsWith(`.${host}`))) {
    throw new Error(`Corporate event ${event.id} uses a forbidden third-party source: ${sourceHost}`)
  }

  const duplicateKey = `${event.assetId}|${event.date}|${event.type}`
  if (assetDateTypeKeys.has(duplicateKey)) throw new Error(`Duplicate asset/date/type corporate event: ${duplicateKey}`)
  assetDateTypeKeys.add(duplicateKey)

  if (event.type === 'DIVIDEND') {
    if (event.timing !== 'PRE_OPEN') throw new Error(`Dividend ${event.id} must post on paymentDate at PRE_OPEN`)
    if (event.payload.paymentDate !== event.date) throw new Error(`Dividend ${event.id} paymentDate must equal event date`)
  }
  if (event.type === 'SPLIT' && event.payload.numerator <= event.payload.denominator) {
    throw new Error(`Split ${event.id} must increase shares`)
  }
  if (event.type === 'REVERSE_SPLIT' && event.payload.numerator >= event.payload.denominator) {
    throw new Error(`Reverse split ${event.id} must reduce shares`)
  }
  if ((event.type === 'SPLIT' || event.type === 'REVERSE_SPLIT') && event.payload.cashInLieuPrice !== undefined && event.payload.cashInLieuPrice <= 0) {
    throw new Error(`Corporate event ${event.id} cashInLieuPrice must be positive`)
  }
  if (event.type === 'MERGER') {
    const hasShareConsideration = event.payload.targetAssetId !== undefined
    const hasCashConsideration = event.payload.cashPerShare !== undefined
    if (!hasShareConsideration && !hasCashConsideration) throw new Error(`Merger ${event.id} must define share and/or cash consideration`)
    if (hasShareConsideration && (!event.payload.targetMarket || !event.payload.targetCurrency || !event.payload.shareNumerator || !event.payload.shareDenominator)) {
      throw new Error(`Merger ${event.id} share consideration is incomplete`)
    }
    if ((event.payload.shareNumerator !== undefined && event.payload.shareNumerator <= 0) || (event.payload.shareDenominator !== undefined && event.payload.shareDenominator <= 0)) {
      throw new Error(`Merger ${event.id} share ratio must be positive`)
    }
    if (event.payload.cashPerShare !== undefined && event.payload.cashPerShare <= 0) throw new Error(`Merger ${event.id} cashPerShare must be positive`)
  }
  if (event.type === 'DELISTING' && event.payload.cashOutPerShare !== undefined && event.payload.cashOutPerShare <= 0) {
    throw new Error(`Delisting ${event.id} cashOutPerShare must be positive`)
  }
  if (event.type === 'LISTING') {
    const listedFrom = listedFromByAsset.get(event.assetId)
    if (!listedFrom) throw new Error(`Listing ${event.id} has no manifest listedFrom`)
    if (listedFrom !== event.date) throw new Error(`Listing ${event.id} date ${event.date} does not match manifest listedFrom ${listedFrom}`)
    if (event.timing !== 'PRE_OPEN') throw new Error(`Listing ${event.id} must be PRE_OPEN`)
  }
}

for (const asset of manifestAssets.filter((asset) => asset.listedFrom > firstCoverageSession)) {
  const listings = parsed.events.filter((event) => event.assetId === asset.id && event.type === 'LISTING')
  if (listings.length !== 1) throw new Error(`Expected exactly one post-coverage listing event for ${asset.id}, found ${listings.length}`)
}

for (const verified of VERIFIED_US_SPLIT_EVENTS) {
  const matches = parsed.events.filter((event) => event.assetId === verified.assetId
    && event.date === verified.effectiveDate
    && event.type === 'SPLIT'
    && event.payload.numerator === verified.numerator
    && event.payload.denominator === verified.denominator)
  if (matches.length !== 1) throw new Error(`Verified Nasdaq split mismatch for ${verified.assetId} on ${verified.effectiveDate}`)
}

const verifiedUsSplitKeys = new Set(VERIFIED_US_SPLIT_EVENTS.map((event) => `${event.assetId}|${event.effectiveDate}|${event.numerator}|${event.denominator}`))
for (const event of parsed.events) {
  if (event.type !== 'SPLIT' || (!event.assetId.startsWith('U') && !event.assetId.startsWith('UE'))) continue
  const key = `${event.assetId}|${event.date}|${event.payload.numerator}|${event.payload.denominator}`
  if (!verifiedUsSplitKeys.has(key)) throw new Error(`U.S. split ${event.id} is not synchronized with the Nasdaq raw-price restoration table`)
}

console.log(`Validated ${parsed.events.length} corporate events across ${shards.length} shards (${parsed.source.mode}); ${manifestAssets.length} assets checked`)
