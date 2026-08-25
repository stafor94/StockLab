import { useEffect, useMemo, useState } from 'react'
import type { AssetManifestItem } from '../../types/market'
import { useGameStore } from '../../stores/gameStore'
import {
  getVisibleAssets,
  getVisibleSectors,
  type AssetBrowserFilter,
} from './assetCatalog'
import { AssetDetail } from './AssetDetail'
import { useMarketCatalog } from './useMarketCatalog'

const filters: Array<{ id: AssetBrowserFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'KR', label: '한국' },
  { id: 'US', label: '미국' },
  { id: 'ETF', label: 'ETF' },
]

function assetSubtitle(asset: AssetManifestItem): string {
  const market = asset.market === 'KR' ? '한국' : '미국'
  const kind = asset.kind === 'etf' ? 'ETF' : '주식'
  return `${market} · ${kind} · ${asset.sector}`
}

export function MarketBrowser() {
  const gameDate = useGameStore((state) => state.gameDate)
  const { assets, source, error } = useMarketCatalog()
  const [filter, setFilter] = useState<AssetBrowserFilter>('all')
  const [searchText, setSearchText] = useState('')
  const [sector, setSector] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sectors = useMemo(() => getVisibleSectors(assets, gameDate), [assets, gameDate])
  const visibleAssets = useMemo(
    () => getVisibleAssets(assets, gameDate, filter, searchText, sector),
    [assets, filter, gameDate, searchText, sector],
  )

  useEffect(() => {
    if (visibleAssets.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !visibleAssets.some((asset) => asset.id === selectedId)) {
      setSelectedId(visibleAssets[0].id)
    }
  }, [selectedId, visibleAssets])

  useEffect(() => {
    if (sector !== 'all' && !sectors.includes(sector)) setSector('all')
  }, [sector, sectors])

  const selectedAsset = visibleAssets.find((asset) => asset.id === selectedId) ?? null

  return (
    <main className="market-browser">
      <section className="panel market-browser-header">
        <div>
          <p className="section-label">MARKET BROWSER</p>
          <h2>시장 탐색</h2>
          <p>실제 회사명과 티커는 숨기고, 업종과 가상 회사명만 제공합니다.</p>
        </div>
        <div className="catalog-status">
          <span>{source === 'manifest' ? '실데이터 카탈로그' : '가명 카탈로그'}</span>
          <strong>{visibleAssets.length}개</strong>
          {error && <small>정적 카탈로그로 대체됨</small>}
        </div>
      </section>

      <section className="market-browser-grid">
        <aside className="panel asset-browser-list" aria-label="투자 대상 목록">
          <div className="asset-filter-tabs" aria-label="시장 필터">
            {filters.map((item) => (
              <button
                className={filter === item.id ? 'active' : ''}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="asset-search">
            <span>종목 검색</span>
            <input
              aria-label="종목 검색"
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="가상 회사명 또는 산업군"
              type="search"
              value={searchText}
            />
          </label>

          <label className="sector-filter">
            <span>산업군</span>
            <select value={sector} onChange={(event) => setSector(event.target.value)}>
              <option value="all">전체 산업군</option>
              {sectors.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <div className="asset-list-scroll">
            {visibleAssets.length === 0 ? (
              <div className="asset-list-empty">조건에 맞는 상장 종목이 없습니다.</div>
            ) : visibleAssets.map((asset) => (
              <button
                className={`asset-list-row ${selectedId === asset.id ? 'active' : ''}`}
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                type="button"
              >
                <span className="asset-list-title">
                  <strong>{asset.alias}</strong>
                  <small>{asset.id}</small>
                </span>
                <span>{assetSubtitle(asset)}</span>
              </button>
            ))}
          </div>
        </aside>

        <AssetDetail asset={selectedAsset} gameDate={gameDate} />
      </section>
    </main>
  )
}
