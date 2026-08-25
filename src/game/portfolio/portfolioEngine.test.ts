import { describe, expect, it } from 'vitest'
import { buildPortfolioSnapshot, getReturnBadge, selectKnownValuationPrice } from './portfolioEngine'
import { createInitialLoan } from '../save'

const series = {
  schemaVersion: 1,
  assetId: 'K001',
  market: 'KR' as const,
  currency: 'KRW' as const,
  bars: [
    { date: '2018-01-02', open: 100, high: 120, low: 90, close: 110, volume: 1 },
    { date: '2018-01-03', open: 130, high: 140, low: 120, close: 135, volume: 1 },
  ],
}

describe('portfolio engine', () => {
  it('never exposes same-day close before or at market open', () => {
    expect(selectKnownValuationPrice(series, '2018-01-03', 'preopen')).toMatchObject({ price: 110, source: 'previous-close' })
    expect(selectKnownValuationPrice(series, '2018-01-03', 'opened')).toMatchObject({ price: 130, source: 'today-open' })
  })

  it('neutralizes principal repayment in strategy return while keeping net worth separate', () => {
    const loan = createInitialLoan()
    loan.principal = 9_000_000
    const snapshot = buildPortfolioSnapshot({
      gameDate: '2018-01-03', marketSessionPhase: 'preopen', krwCash: 9_000_000, usdCash: 0,
      loan, positions: [], pendingSettlements: [], trades: [], prices: {}, usdKrwRate: null,
    })
    expect(snapshot.grossAssetsKrw).toBe(9_000_000)
    expect(snapshot.principalRepaidKrw).toBe(1_000_000)
    expect(snapshot.strategyReturnRate).toBeCloseTo(0)
    expect(snapshot.netWorthKrw).toBe(0)
  })

  it('marks valuation incomplete when a held asset has no historical price', () => {
    const snapshot = buildPortfolioSnapshot({
      gameDate: '2018-01-03', marketSessionPhase: 'preopen', krwCash: 5_000_000, usdCash: 0,
      loan: createInitialLoan(), positions: [{ assetId: 'K001', market: 'KR', currency: 'KRW', quantity: 10, averagePrice: 100 }],
      pendingSettlements: [], trades: [], prices: {}, usdKrwRate: null,
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
