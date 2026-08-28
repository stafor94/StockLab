export interface DatedSplitRatio {
  effectiveDate: string
  numerator: number
  denominator: number
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
