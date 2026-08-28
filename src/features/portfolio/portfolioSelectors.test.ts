import { describe, expect, it } from 'vitest'
import type { PositionValuation } from '../../game/portfolio/types'
import { selectTopPositionValuations } from './portfolioSelectors'

function position(assetId: string, marketValueKrw: number | null, quantity = 1): PositionValuation {
  return {
    assetId,
    quantity,
    currency: 'KRW',
    averagePrice: 100,
    price: marketValueKrw === null ? null : marketValueKrw / Math.max(quantity, 1),
    priceDate: marketValueKrw === null ? null : '2018-01-02',
    priceSource: marketValueKrw === null ? null : 'today-close',
    marketValue: marketValueKrw,
    costBasis: quantity * 100,
    unrealizedPnl: marketValueKrw === null ? null : marketValueKrw - (quantity * 100),
    unrealizedRate: marketValueKrw === null ? null : ((marketValueKrw - (quantity * 100)) / (quantity * 100)) * 100,
    marketValueKrw,
    unrealizedPnlKrw: marketValueKrw === null ? null : marketValueKrw - (quantity * 100),
  }
}

describe('selectTopPositionValuations', () => {
  it('keeps positive holdings, sorts by KRW valuation descending, and caps the result', () => {
    const positions = [
      position('A', 1000),
      position('B', 5000),
      position('C', 3000),
      position('D', 2000),
      position('E', 4000),
      position('ZERO', 9999, 0),
    ]

    expect(selectTopPositionValuations(positions, 4).map((item) => item.assetId)).toEqual(['B', 'E', 'C', 'D'])
    expect(positions.map((item) => item.assetId)).toEqual(['A', 'B', 'C', 'D', 'E', 'ZERO'])
  })

  it('puts holdings without a comparable KRW valuation after valued holdings', () => {
    expect(selectTopPositionValuations([
      position('UNKNOWN', null),
      position('KNOWN', 1000),
    ]).map((item) => item.assetId)).toEqual(['KNOWN', 'UNKNOWN'])
  })
})
