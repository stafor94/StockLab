export interface VerifiedUsSplitEvent {
  assetId: string
  effectiveDate: string
  numerator: number
  denominator: number
}

/**
 * U.S. corporate-action dates are the first sessions trading on the post-split basis.
 * Real tickers remain in the private build-time source map; this table intentionally
 * stores only masked game IDs and verified economic ratios.
 */
export const VERIFIED_US_SPLIT_EVENTS: readonly VerifiedUsSplitEvent[] = [
  { assetId: 'U001', effectiveDate: '2021-07-20', numerator: 4, denominator: 1 },
  { assetId: 'U001', effectiveDate: '2024-06-10', numerator: 10, denominator: 1 },
  { assetId: 'U004', effectiveDate: '2024-07-15', numerator: 10, denominator: 1 },
  { assetId: 'U006', effectiveDate: '2022-07-18', numerator: 20, denominator: 1 },
  { assetId: 'U007', effectiveDate: '2020-08-31', numerator: 4, denominator: 1 },
  { assetId: 'U009', effectiveDate: '2020-08-31', numerator: 5, denominator: 1 },
  { assetId: 'U009', effectiveDate: '2022-08-25', numerator: 3, denominator: 1 },
  { assetId: 'U016', effectiveDate: '2020-10-27', numerator: 4, denominator: 1 },
  { assetId: 'U032', effectiveDate: '2022-06-06', numerator: 20, denominator: 1 },
  { assetId: 'U033', effectiveDate: '2024-02-26', numerator: 3, denominator: 1 },
  { assetId: 'UE006', effectiveDate: '2024-03-07', numerator: 3, denominator: 1 },
] as const

export const US_SPLIT_REFERENCE = 'https://www.nasdaq.com/market-activity/stock-splits'
