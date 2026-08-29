import type { DailyMarketCapitalizationBar } from '../../types/market'

export interface DatedSplitRatio {
  effectiveDate: string
  numerator: number
  denominator: number
}

export interface MarketCapPriceBar {
  date: string
  open: number
  close: number
}

function marketCap(price: number, shares: number): number {
  const value = Math.round(price * shares)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('market-cap calculation produced an invalid safe-integer value')
  return value
}

export function buildDailyMarketCapBar(
  price: MarketCapPriceBar,
  sharesOutstanding: number,
  previousMarketCapClose: number | null,
): DailyMarketCapitalizationBar {
  return {
    date: price.date,
    preopen: previousMarketCapClose,
    open: marketCap(price.open, sharesOutstanding),
    close: marketCap(price.close, sharesOutstanding),
  }
}

export function alignSharesToPriceDate(
  sharesOutstanding: number,
  sharesAsOfDate: string,
  priceDate: string,
  splitEvents: readonly DatedSplitRatio[],
): number {
  if (!Number.isFinite(sharesOutstanding) || sharesOutstanding <= 0) {
    throw new Error('sharesOutstanding must be positive')
  }
  let shares = sharesOutstanding
  const sorted = [...splitEvents].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
  if (priceDate >= sharesAsOfDate) {
    for (const event of sorted) {
      if (event.effectiveDate <= sharesAsOfDate || event.effectiveDate > priceDate) continue
      shares *= event.numerator / event.denominator
    }
  } else {
    for (const event of sorted) {
      if (event.effectiveDate <= priceDate || event.effectiveDate > sharesAsOfDate) continue
      shares *= event.denominator / event.numerator
    }
  }
  if (!Number.isFinite(shares) || shares <= 0) throw new Error('split-aligned shares outstanding are invalid')
  return shares
}
