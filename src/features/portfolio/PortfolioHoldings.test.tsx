import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PositionValuation } from '../../game/portfolio/types'
import type { AssetManifestItem } from '../../types/market'
import { PortfolioHoldings } from './PortfolioHoldings'

afterEach(cleanup)

const asset: AssetManifestItem = { id: 'K001', alias: '한빛전자', kind: 'stock', market: 'KR', currency: 'KRW', sector: '전자', listedFrom: '2018-01-01', dataPath: '/data/market/K001.json' }

function position(priceSource: PositionValuation['priceSource']): PositionValuation {
  return { assetId: 'K001', quantity: 10, currency: 'KRW', averagePrice: 50000, price: 55000, priceDate: '2018-01-02', priceSource, marketValue: 550000, costBasis: 500000, unrealizedPnl: 50000, unrealizedRate: 10, marketValueKrw: 550000, unrealizedPnlKrw: 50000 }
}

describe('PortfolioHoldings', () => {
  it('shows holding value and signed profit information as a compact row', () => {
    render(<PortfolioHoldings positions={[position('today-close')]} assets={[asset]}/>)
    expect(screen.getByText('한빛전자')).toBeTruthy()
    expect(screen.getByText('₩550,000')).toBeTruthy()
    expect(screen.getByText(/\+₩50,000 · \+10.00%/)).toBeTruthy()
    expect(screen.getByText('2018-01-02 종가')).toBeTruthy()
  })

  it('turns a tradable holding into an order button and opens the selected asset', () => {
    const onOpenOrder = vi.fn()
    render(<PortfolioHoldings positions={[position('today-open')]} assets={[asset]} isOrderAvailable={() => true} onOpenOrder={onOpenOrder}/>)

    const orderButton = screen.getByRole('button', { name: '한빛전자 주문 거래 열기' })
    expect(screen.getByText('눌러서 주문')).toBeTruthy()
    fireEvent.click(orderButton)

    expect(onOpenOrder).toHaveBeenCalledTimes(1)
    expect(onOpenOrder).toHaveBeenCalledWith(asset)
  })
})
