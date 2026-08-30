import { alignSharesToPriceDate, buildDailyMarketCapBar, type DatedSplitRatio } from '../../src/data/ingestion/marketCapShares'
import { selectSecSharesAvailableBefore, type SecSharesOutstandingSnapshot } from '../../src/data/ingestion/secSharesOutstanding'
import type { AssetMarketCapitalizationSeries, AssetPriceSeries, DailyMarketCapitalizationBar } from '../../src/types/market'

const MAX_UNEXPLAINED_SEC_SHARE_FACTOR = 100

function assertSecShareHistoryPlausible(
  assetId: string,
  snapshots: readonly SecSharesOutstandingSnapshot[],
  splits: readonly DatedSplitRatio[],
): void {
  const ordered = [...snapshots].sort((left, right) =>
    left.asOfDate.localeCompare(right.asOfDate) || left.availableFrom.localeCompare(right.availableFrom),
  )
  let previous: SecSharesOutstandingSnapshot | null = null
  for (const current of ordered) {
    if (!previous) {
      previous = current
      continue
    }
    const priorShares = alignSharesToPriceDate(
      previous.sharesOutstanding,
      previous.asOfDate,
      current.asOfDate,
      splits,
    )
    const factor = current.sharesOutstanding / priorShares
    if (
      !Number.isFinite(factor)
      || factor <= 0
      || factor > MAX_UNEXPLAINED_SEC_SHARE_FACTOR
      || factor < 1 / MAX_UNEXPLAINED_SEC_SHARE_FACTOR
    ) {
      throw new Error(`${assetId}: SEC shares outstanding changed by an implausible factor near ${current.asOfDate}; inspect the tracked snapshot before publishing`)
    }
    previous = current
  }
}

export function buildUsStockMarketCapSeries(
  assetId: string,
  prices: AssetPriceSeries,
  snapshots: readonly SecSharesOutstandingSnapshot[],
  splits: readonly DatedSplitRatio[],
  generatedAt: string,
): AssetMarketCapitalizationSeries {
  if (prices.id !== assetId || prices.market !== 'US' || prices.kind !== 'stock' || prices.currency !== 'USD') {
    throw new Error(`${assetId}: U.S. stock price series metadata does not match the market-cap build input`)
  }
  if (snapshots.length === 0) {
    throw new Error(`${assetId}: tracked SEC shares snapshot has no usable rows`)
  }

  assertSecShareHistoryPlausible(assetId, snapshots, splits)
  const bars: DailyMarketCapitalizationBar[] = []
  for (const price of prices.bars) {
    const snapshot = selectSecSharesAvailableBefore(snapshots, price.date)
    if (!snapshot) {
      bars.push({ date: price.date, preopen: bars.at(-1)?.close ?? null, open: null, close: null })
      continue
    }
    const shares = alignSharesToPriceDate(snapshot.sharesOutstanding, snapshot.asOfDate, price.date, splits)
    bars.push(buildDailyMarketCapBar(price, shares, bars.at(-1)?.close ?? null))
  }

  return {
    schemaVersion: 1,
    id: assetId,
    market: 'US',
    currency: 'USD',
    source: {
      authoritativeProvider: 'Nasdaq Historical Quotes + SEC EDGAR',
      methodology: 'Existing unadjusted Nasdaq price × latest issuer-level common shares outstanding publicly filed before the trading date; tracked SEC snapshots preserve filing availability, and verified split ratios align share and price dates.',
      generatedAt,
    },
    bars,
  }
}
