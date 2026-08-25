import { describe, expect, it } from 'vitest'
import { calculateHistoricalSellCosts, getKrStockVenue } from './historicalCosts'

function kr(assetId: string, tradeDate: string, grossAmount = 1_000_000) {
  return calculateHistoricalSellCosts({ assetId, market: 'KR', grossAmount, quantity: 10, unitPrice: grossAmount / 10, tradeDate })
}

function us(tradeDate: string, grossAmount = 10_000, quantity = 100) {
  return calculateHistoricalSellCosts({ assetId: 'U001', market: 'US', grossAmount, quantity, unitPrice: grossAmount / quantity, tradeDate })
}

describe('historical sell costs', () => {
  it('applies 2018 KOSPI transaction tax plus rural special tax', () => {
    expect(kr('K001', '2018-01-02')).toMatchObject({ transactionTax: 1500, ruralSpecialTax: 1500, total: 3000 })
  })

  it('switches the 2019 Korean tax rate exactly on 2019-06-03', () => {
    expect(kr('K001', '2019-06-02').total).toBe(3000)
    expect(kr('K001', '2019-06-03')).toMatchObject({ transactionTax: 1000, ruralSpecialTax: 1500, total: 2500 })
  })

  it('applies the 2025 and restored 2026 KOSPI totals', () => {
    expect(kr('K001', '2025-06-02').total).toBe(1500)
    expect(kr('K001', '2026-01-02').total).toBe(2000)
  })

  it('keeps Korean ETFs exempt from securities transaction tax', () => {
    expect(kr('KE001', '2026-08-25')).toEqual({ transactionTax: 0, ruralSpecialTax: 0, secSection31Fee: 0, finraTaf: 0, total: 0 })
  })

  it('tracks the K017 KOSDAQ-to-KOSPI transfer on 2018-02-09', () => {
    expect(getKrStockVenue('K017', '2018-02-08')).toBe('KOSDAQ')
    expect(getKrStockVenue('K017', '2018-02-09')).toBe('KOSPI')
    expect(kr('K017', '2018-02-08')).toMatchObject({ transactionTax: 3000, ruralSpecialTax: 0 })
    expect(kr('K017', '2018-02-09')).toMatchObject({ transactionTax: 1500, ruralSpecialTax: 1500 })
  })

  it('changes the U.S. Section 31 pass-through on the official effective dates', () => {
    expect(us('2025-05-13')).toMatchObject({ secSection31Fee: 0.28, finraTaf: 0.02, total: 0.3 })
    expect(us('2025-05-14')).toMatchObject({ secSection31Fee: 0, finraTaf: 0.02, total: 0.02 })
    expect(us('2026-04-04')).toMatchObject({ secSection31Fee: 0.21, finraTaf: 0.02, total: 0.23 })
  })

  it('uses the 2026 FINRA TAF rate and per-trade cap', () => {
    expect(us('2026-04-06', 100_000, 100).finraTaf).toBe(0.02)
    expect(us('2026-04-06', 10_000_000, 100_000).finraTaf).toBe(9.79)
  })
})
