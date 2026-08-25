import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PositionValuation } from '../../game/portfolio/types'
import type { AssetManifestItem } from '../../types/market'
import { PortfolioHoldings } from './PortfolioHoldings'

afterEach(cleanup)

describe('PortfolioHoldings', () => {
  it('shows holding value and signed profit information as a compact row', () => {
    const positions: PositionValuation[] = [{ assetId: 'K001', quantity: 10, currency: 'KRW', averagePrice: 50000, price: 55000, priceDate: '2018-01-02', priceSource: 'today-close', marketValue: 550000, costBasis: 500000, unrealizedPnl: 50000, unrealizedRate: 10, marketValueKrw: 550000, unrealizedPnlKrw: 50000 }]
    const assets: AssetManifestItem[] = [{ id: 'K001', alias: '한빛전자', kind: 'stock', market: 'KR', currency: 'KRW', sector: '전자', listedFrom: '2018-01-01', dataPath: '/data/market/K001.json' }]
    render(<PortfolioHoldings positions={positions} assets={assets}/>)
    expect(screen.getByText('한빛전자')).toBeTruthy()
    expect(screen.getByText('₩550,000')).toBeTruthy()
    expect(screen.getByText(/\+₩50,000 · \+10.00%/)).toBeTruthy()
    expect(screen.getByText('2018-01-02 종가')).toBeTruthy()
  })
})
