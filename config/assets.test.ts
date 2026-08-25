import { describe, expect, it } from 'vitest'
import { ASSET_CATALOG, ASSET_CATALOG_SIZE } from './assets'

describe('asset catalog', () => {
  it('keeps the planned 109 masked assets with stable unique IDs and paths', () => {
    expect(ASSET_CATALOG_SIZE).toBe(109)
    expect(new Set(ASSET_CATALOG.map((asset) => asset.id)).size).toBe(109)
    expect(new Set(ASSET_CATALOG.map((asset) => asset.dataPath)).size).toBe(109)
  })

  it('does not expose source tickers or real company names in runtime metadata', () => {
    for (const asset of ASSET_CATALOG) {
      expect(asset).not.toHaveProperty('ticker')
      expect(asset).not.toHaveProperty('symbol')
      expect(asset).not.toHaveProperty('sourceSymbol')
      expect(asset.listedFrom).toBe('2018-01-01')
    }
  })
})
