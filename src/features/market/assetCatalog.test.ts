import { describe, expect, it } from 'vitest'
import { getFallbackCatalog, getVisibleAssets } from './assetCatalog'

describe('asset catalog visibility', () => {
  const assets = getFallbackCatalog()

  it('does not expose assets before their listing date', () => {
    const visible = getVisibleAssets(assets, '2018-01-02', 'all', '', 'all')
    expect(visible.some((asset) => asset.id === 'K013')).toBe(false)
    expect(visible.some((asset) => asset.id === 'U041')).toBe(false)
    expect(visible.some((asset) => asset.id === 'K001')).toBe(true)
  })

  it('reveals an asset when its listing date is reached', () => {
    const before = getVisibleAssets(assets, '2022-01-26', 'KR', '', 'all')
    const onDate = getVisibleAssets(assets, '2022-01-27', 'KR', '', 'all')
    expect(before.some((asset) => asset.id === 'K013')).toBe(false)
    expect(onDate.some((asset) => asset.id === 'K013')).toBe(true)
  })

  it('filters by market, ETF kind, search text, and sector', () => {
    expect(getVisibleAssets(assets, '2026-01-01', 'ETF', '', 'all').every((asset) => asset.kind === 'etf')).toBe(true)
    expect(getVisibleAssets(assets, '2026-01-01', 'US', '반도체', 'all').every((asset) => asset.market === 'US')).toBe(true)
    expect(getVisibleAssets(assets, '2026-01-01', 'all', '영진전자', 'all').map((asset) => asset.id)).toEqual(['K001'])
  })
})
