import { useEffect, useMemo, useState } from 'react'
import type { AssetManifestItem } from '../../types/market'
import { useGameStore } from '../../stores/gameStore'
import { buildMarketOpenContext } from '../trading/buildMarketOpenContext'
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
  const isTradingDate = Boolean(calendars && (calendars.KR.tradingDates.includes(game.gameDate) || calendars.US.tradingDates.includes(game.gameDate)))

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
    if (!calendars || !isTradingDate || game.marketSessionPhase !== 'preopen') return
    setProcessingOpen(true)
    setOpenMessage(null)
    const context = await buildMarketOpenContext({
      date: game.gameDate,
      orders: todaysOrders,
      assets,
      calendars,
    })
    const results = game.executeMarketOpen(context)
    const filled = results.filter((result) => result.status === 'filled').length
    const cancelled = results.length - filled
    setOpenMessage(todaysOrders.length === 0
      ? '장을 시작했습니다. 당일 시가가 공개됩니다.'
      : `시가 체결 ${filled}건${cancelled > 0 ? ` · 취소 ${cancelled}건` : ''}`)
    setProcessingOpen(false)
  }

  const closeMarket = () => {
    const result = game.closeMarket()
    setOpenMessage(result.message)
  }

  const handleSessionAction = () => {
    if (game.marketSessionPhase === 'opened') {
      closeMarket()
      return
    }
    if (game.marketSessionPhase === 'preopen') void executeOpen()
  }

  const sessionButtonLabel = !isTradingDate
    ? '오늘은 양시장 휴장'
    : game.marketSessionPhase === 'closed'
      ? '오늘 장 마감 완료'
      : game.marketSessionPhase === 'opened'
        ? '장 마감 · OHLC 공개'
        : processingOpen
          ? '시가 확인 중…'
          : todaysOrders.length > 0
            ? `장 시작 · ${todaysOrders.length}건 체결`
            : '장 시작 · 주문 없음'

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
            disabled={!calendars || !isTradingDate || game.marketSessionPhase === 'closed' || processingOpen}
            type="button"
            onClick={handleSessionAction}
          >
            {sessionButtonLabel}
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
