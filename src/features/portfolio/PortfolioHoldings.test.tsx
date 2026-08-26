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
  it('shows average price plus two prominent value rows without quote metadata', () => {
    render(<PortfolioHoldings positions={[position('today-close')]} assets={[asset]}/>)
    expect(screen.getByText('한빛전자')).toBeTruthy()
    expect(screen.getByText('평단 50,000원')).toBeTruthy()
    expect(screen.getByText('550,000원')).toBeTruthy()
    expect(screen.getByText(/\+50,000원 · \+10.00%/)).toBeTruthy()
    expect(screen.queryByText('2018-01-02 종가')).toBeNull()
    expect(screen.queryByText('눌러서 주문')).toBeNull()
  })

  it('keeps a tradable holding clickable without an extra order hint row', () => {
    const onOpenOrder = vi.fn()
    render(<PortfolioHoldings positions={[position('today-open')]} assets={[asset]} isOrderAvailable={() => true} onOpenOrder={onOpenOrder}/>)

    const orderButton = screen.getByRole('button', { name: '한빛전자 주문 거래 열기' })
    expect(screen.queryByText('2018-01-02 시가')).toBeNull()
    expect(screen.queryByText('눌러서 주문')).toBeNull()
    fireEvent.click(orderButton)

    expect(onOpenOrder).toHaveBeenCalledTimes(1)
    expect(onOpenOrder).toHaveBeenCalledWith(asset)
  })
})
