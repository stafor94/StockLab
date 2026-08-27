import { describe, expect, it } from 'vitest'
import type { MarketSessionState } from '../trading/types'
import type { AssetPriceSeries } from '../../types/market'
import { createInitialLoan } from '../save'
import { buildPortfolioSnapshot, getReturnBadge, selectKnownValuationPrice } from './portfolioEngine'

const series: AssetPriceSeries = {
  schemaVersion: 1,
  id: 'K001',
  market: 'KR',
  kind: 'stock',
  currency: 'KRW',
  bars: [
    { date: '2018-01-02', open: 100, high: 120, low: 90, close: 110, volume: 1 },
    { date: '2018-01-03', open: 130, high: 140, low: 120, close: 135, volume: 1 },
  ],
}

const session = (phase: MarketSessionState['phase'], tradingDate: string | null): MarketSessionState => ({ phase, tradingDate })

describe('portfolio engine', () => {
  it('uses previous close before open, open during the market session, and close after that market closes', () => {
    expect(selectKnownValuationPrice(series, '2018-01-03', session('preopen', null))).toMatchObject({ price: 110, source: 'previous-close' })
    expect(selectKnownValuationPrice(series, '2018-01-03', session('opened', '2018-01-03'))).toMatchObject({ price: 130, source: 'today-open' })
    expect(selectKnownValuationPrice(series, '2018-01-03', session('closed', '2018-01-03'))).toMatchObject({ price: 135, source: 'today-close' })
  })

  it('keeps valuation on a market own trading date when another market advances', () => {
    expect(selectKnownValuationPrice(series, '2018-01-04', session('closed', '2018-01-03'))).toMatchObject({
      price: 135,
      priceDate: '2018-01-03',
      source: 'today-close',
    })
  })

  it('neutralizes principal repayment in strategy return while keeping net worth separate', () => {
    const loan = createInitialLoan()
    loan.principal = 9_000_000
    const snapshot = buildPortfolioSnapshot({ krwCash: 9_000_000, usdCash: 0, loan, positions: [], pendingSettlements: [], trades: [], prices: {}, usdKrwRate: null })
    expect(snapshot.grossAssetsKrw).toBe(9_000_000)
    expect(snapshot.principalRepaidKrw).toBe(1_000_000)
    expect(snapshot.strategyReturnRate).toBeCloseTo(0)
    expect(snapshot.netWorthKrw).toBe(0)
  })

  it('marks valuation incomplete when a held asset has no historical price', () => {
    const snapshot = buildPortfolioSnapshot({
      krwCash: 5_000_000,
      usdCash: 0,
      loan: createInitialLoan(),
      positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 100 }],
      pendingSettlements: [],
      trades: [],
      prices: {},
      usdKrwRate: null,
    })
    expect(snapshot.valuationComplete).toBe(false)
    expect(snapshot.grossAssetsKrw).toBeNull()
    expect(snapshot.missingPriceAssetIds).toEqual(['K001'])
  })

  it('uses return thresholds for badge progression', () => {
    expect(getReturnBadge(0).label).toBe('초보 투자자')
    expect(getReturnBadge(52).label).toBe('큰손')
    expect(getReturnBadge(205).label).toBe('월가의 전설')
  })
})
