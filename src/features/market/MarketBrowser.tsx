import { useEffect, useMemo, useState } from 'react'
import { marketDataClient } from '../../data/marketDataClient'
import { getSettlementDate } from '../../game/settlement/settlementRules'
import type { AssetManifestItem } from '../../types/market'
import { useGameStore } from '../../stores/gameStore'
import {
  getVisibleAssets,
  getVisibleSectors,
  type AssetBrowserFilter,
} from './assetCatalog'
import { AssetDetail } from './AssetDetail'
import { useMarketCalendars } from './useMarketCalendars'
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
  const game = useGameStore()
  const { assets, source, error } = useMarketCatalog()
  const { calendars } = useMarketCalendars()
  const [filter, setFilter] = useState<AssetBrowserFilter>('all')
  const [searchText, setSearchText] = useState('')
  const [sector, setSector] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openMessage, setOpenMessage] = useState<string | null>(null)
  const [processingOpen, setProcessingOpen] = useState(false)

  const sectors = useMemo(() => getVisibleSectors(assets, game.gameDate), [assets, game.gameDate])
  const visibleAssets = useMemo(
    () => getVisibleAssets(assets, game.gameDate, filter, searchText, sector),
    [assets, filter, game.gameDate, searchText, sector],
  )
  const todaysOrders = game.pendingOrders.filter((order) => order.tradeDate === game.gameDate)

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

  const executeOpen = async () => {
    if (!calendars || todaysOrders.length === 0 || game.marketSessionPhase !== 'preopen') return
    setProcessingOpen(true)
    setOpenMessage(null)
    const openPrices: Record<string, number | undefined> = {}
    const settlementDates: Record<string, string | undefined> = {}
    const uniqueAssetIds = [...new Set(todaysOrders.map((order) => order.assetId))]

    await Promise.all(uniqueAssetIds.map(async (assetId) => {
      const asset = assets.find((item) => item.id === assetId)
      if (!asset) return
      try {
        const series = await marketDataClient.loadAssetPriceSeriesAtPath(asset.dataPath)
        openPrices[assetId] = series.bars.find((bar) => bar.date === game.gameDate)?.open
      } catch {
        openPrices[assetId] = undefined
      }
      if (todaysOrders.some((order) => order.assetId === assetId && order.kind.startsWith('sell-'))) {
        settlementDates[assetId] = getSettlementDate(asset.market, game.gameDate, calendars[asset.market]) ?? undefined
      }
    }))

    const results = game.executeMarketOpen({ date: game.gameDate, openPrices, settlementDates })
    const filled = results.filter((result) => result.status === 'filled').length
    const cancelled = results.length - filled
    setOpenMessage(`시가 체결 ${filled}건${cancelled > 0 ? ` · 취소 ${cancelled}건` : ''}`)
    setProcessingOpen(false)
  }

  return (
    <main className="market-browser">
      <section className="panel market-browser-header">
        <div>
          <p className="section-label">MARKET BROWSER</p>
          <h2>시장 탐색</h2>
          <p>실제 회사명과 티커는 숨기고, 업종과 가상 회사명만 제공합니다.</p>
        </div>
        <div className="market-open-control">
          <div className="catalog-status">
            <span>{source === 'manifest' ? '실데이터 카탈로그' : '가명 카탈로그'}</span>
            <strong>{visibleAssets.length}개</strong>
            {error && <small>정적 카탈로그로 대체됨</small>}
          </div>
          <button
            className="open-market-button"
            disabled={!calendars || todaysOrders.length === 0 || game.marketSessionPhase === 'opened' || processingOpen}
            type="button"
            onClick={() => void executeOpen()}
          >
            {game.marketSessionPhase === 'opened'
              ? '오늘 시가 체결 완료'
              : processingOpen
                ? '시가 확인 중…'
                : `장 시작 · ${todaysOrders.length}건 체결`}
          </button>
          {openMessage && <small className="open-result" aria-live="polite">{openMessage}</small>}
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

        <AssetDetail asset={selectedAsset} gameDate={game.gameDate} />
      </section>
    </main>
  )
}
