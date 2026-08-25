import { ASSET_CATALOG, type CatalogAsset } from '../../../config/assets'
import type { AssetManifestItem } from '../../types/market'

export type AssetBrowserFilter = 'all' | 'KR' | 'US' | 'ETF'

const LISTING_VISIBILITY_OVERRIDES: Readonly<Record<string, string>> = {
  K013: '2022-01-27',
  K019: '2020-07-02',
  K024: '2021-09-17',
  K033: '2020-10-15',
  K034: '2021-08-10',
  K037: '2021-02-03',
  K038: '2023-10-05',
  U040: '2020-09-30',
  U041: '2019-05-10',
  U042: '2021-04-14',
  KE007: '2018-09-12',
  KE009: '2021-04-09',
}

function withVisibilityDate(asset: CatalogAsset): AssetManifestItem {
  return {
    ...asset,
    listedFrom: LISTING_VISIBILITY_OVERRIDES[asset.id] ?? asset.listedFrom,
  }
}

export function getFallbackCatalog(): AssetManifestItem[] {
  return ASSET_CATALOG.map(withVisibilityDate)
}

export function getVisibleAssets(
  assets: AssetManifestItem[],
  gameDate: string,
  filter: AssetBrowserFilter,
  searchText: string,
  sector: string,
): AssetManifestItem[] {
  const query = searchText.trim().toLocaleLowerCase('ko-KR')

  return assets
    .filter((asset) => asset.listedFrom <= gameDate)
    .filter((asset) => {
      if (filter === 'KR') return asset.market === 'KR'
      if (filter === 'US') return asset.market === 'US'
      if (filter === 'ETF') return asset.kind === 'etf'
      return true
    })
    .filter((asset) => sector === 'all' || asset.sector === sector)
    .filter((asset) => {
      if (!query) return true
      return `${asset.alias} ${asset.sector}`.toLocaleLowerCase('ko-KR').includes(query)
    })
    .sort((left, right) => {
      if (left.market !== right.market) return left.market.localeCompare(right.market)
      if (left.kind !== right.kind) return left.kind.localeCompare(right.kind)
      return left.alias.localeCompare(right.alias, 'ko-KR')
    })
}

export function getVisibleSectors(assets: AssetManifestItem[], gameDate: string): string[] {
  return [...new Set(
    assets.filter((asset) => asset.listedFrom <= gameDate).map((asset) => asset.sector),
  )].sort((left, right) => left.localeCompare(right, 'ko-KR'))
}
