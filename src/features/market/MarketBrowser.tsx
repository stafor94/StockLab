import { useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { AssetAvatar, SectionHeader } from '../../components/ui'
import type { AssetManifestItem } from '../../types/market'
import { useGameStore } from '../../stores/gameStore'
import { HelpLink } from '../help/HelpCenter'
import { buildMarketOpenContext } from '../trading/buildMarketOpenContext'
import { getVisibleAssets, getVisibleSectors, type AssetBrowserFilter } from './assetCatalog'
import { AssetDetail } from './AssetDetail'
import { useMarketCalendars } from './useMarketCalendars'
import { useMarketCatalog } from './useMarketCatalog'

const filters: Array<{ id: AssetBrowserFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'KR', label: '한국' },
  { id: 'US', label: '미국' },
  { id: 'ETF', label: 'ETF' },
]

const SPLIT_MARKET_LAYOUT_QUERY = '(min-width: 900px)'

function assetSubtitle(asset: AssetManifestItem): string {
  return `${asset.id} · ${asset.sector}`
}

function assetOrderLabel(asset: AssetManifestItem): string {
  const market = asset.market === 'KR' ? '한국' : '미국'
  const kind = asset.kind === 'etf' ? 'ETF' : '주식'
  return `${market} ${kind} · 주문`
}

export function MarketBrowser() {
  const game = useGameStore()
  const { assets } = useMarketCatalog()
  const { calendars } = useMarketCalendars()
  const [filter, setFilter] = useState<AssetBrowserFilter>('all')
  const [searchText, setSearchText] = useState('')
  const [sector, setSector] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openMessage, setOpenMessage] = useState<string | null>(null)
  const [processingOpen, setProcessingOpen] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  const sectors = useMemo(() => getVisibleSectors(assets, game.gameDate), [assets, game.gameDate])
  const visibleAssets = useMemo(() => getVisibleAssets(assets, game.gameDate, filter, searchText, sector), [assets, filter, game.gameDate, searchText, sector])
  const todaysOrders = game.pendingOrders.filter((order) => order.tradeDate === game.gameDate)
  const isTradingDate = Boolean(calendars && (calendars.KR.tradingDates.includes(game.gameDate) || calendars.US.tradingDates.includes(game.gameDate)))

  useEffect(() => {
    if (visibleAssets.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !visibleAssets.some((asset) => asset.id === selectedId)) setSelectedId(visibleAssets[0].id)
  }, [selectedId, visibleAssets])

  useEffect(() => {
    if (sector !== 'all' && !sectors.includes(sector)) setSector('all')
  }, [sector, sectors])

  const selectedAsset = visibleAssets.find((asset) => asset.id === selectedId) ?? null

  const selectAsset = (assetId: string) => {
    setSelectedId(assetId)
    game.markGuidanceExperience('asset-detail-viewed')
    const splitLayout = window.matchMedia?.(SPLIT_MARKET_LAYOUT_QUERY).matches ?? false
    if (!splitLayout) window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const executeOpen = async () => {
    if (!calendars || !isTradingDate || game.marketSessionPhase !== 'preopen') return
    if (todaysOrders.length === 0 && !game.guidance.skipOrderConfirmationShown) {
      if (!window.confirm('접수한 주문이 없습니다. 주문 없이 장을 시작할까요?')) return
      game.confirmSkipOrder()
    }
    setProcessingOpen(true)
    setOpenMessage(null)
    try {
      const context = await buildMarketOpenContext({ date: game.gameDate, orders: todaysOrders, assets, calendars })
      const results = game.executeMarketOpen(context)
      const filled = results.filter((result) => result.status === 'filled').length
      const cancelled = results.length - filled
      setOpenMessage(todaysOrders.length === 0 ? '장을 시작했습니다. 당일 시가가 공개됩니다.' : `시가 체결 ${filled}건${cancelled > 0 ? ` · 취소 ${cancelled}건` : ''}`)
    } finally {
      setProcessingOpen(false)
    }
  }

  const handleSessionAction = () => {
    if (game.marketSessionPhase === 'opened') {
      const result = game.closeMarket()
      setOpenMessage(result.message)
      return
    }
    if (game.marketSessionPhase === 'preopen') void executeOpen()
  }

  const sessionButtonLabel = !isTradingDate
    ? '오늘은 양시장 휴장'
    : game.marketSessionPhase === 'closed' ? '오늘 장 마감 완료'
      : game.marketSessionPhase === 'opened' ? '장 마감'
        : processingOpen ? '시가 확인 중…' : '장 시작'

  return (
    <main className="market-browser">
      <section className="screen-title-section">
        <SectionHeader title="시장" description={`${visibleAssets.length}개 종목 · ${game.marketSessionPhase === 'preopen' ? '개장 전' : game.marketSessionPhase === 'opened' ? '장중' : '장 마감'}`} />
        <div className="market-session-actions"><HelpLink section="orders">주문 규칙</HelpLink><button className="session-action-button" disabled={!calendars || !isTradingDate || game.marketSessionPhase === 'closed' || processingOpen} type="button" onClick={handleSessionAction}>{sessionButtonLabel}</button></div>
        {openMessage && <p className="inline-status-message" aria-live="polite">{openMessage}</p>}
      </section>

      <section className="market-browser-grid">
        <aside className="asset-browser-list" aria-label="투자 대상 목록">
          <div className="segmented-control asset-filter-tabs" aria-label="시장 필터">
            {filters.map((item) => <button aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label}</button>)}
          </div>
          <div className="market-search-row">
            <label className="asset-search"><span className="sr-only">종목 검색</span><input aria-label="종목 검색" onChange={(event) => setSearchText(event.target.value)} placeholder="종목 또는 산업군 검색" type="search" value={searchText} /></label>
            <label className="sector-filter"><span className="sr-only">산업군</span><select aria-label="산업군" value={sector} onChange={(event) => setSector(event.target.value)}><option value="all">전체 산업군</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>

          <div className="asset-list-scroll">
            {visibleAssets.length === 0 ? <div className="compact-empty-state"><strong>조건에 맞는 종목이 없습니다.</strong></div> : visibleAssets.map((asset) => (
              <button className={`asset-list-row ${selectedId === asset.id ? 'active' : ''}`} key={asset.id} onClick={() => selectAsset(asset.id)} type="button">
                <AssetAvatar market={asset.market} kind={asset.kind} />
                <span className="asset-list-copy"><strong>{asset.alias}</strong><small>{assetSubtitle(asset)}</small></span>
                <span className="asset-list-meta">{assetOrderLabel(asset)}<AppIcon name="chevron" size={16}/></span>
              </button>
            ))}
          </div>
        </aside>
        <div className="asset-detail-slot" ref={detailRef}><AssetDetail asset={selectedAsset} gameDate={game.gameDate} /></div>
      </section>
    </main>
  )
}
