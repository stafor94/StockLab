import { useEffect, useMemo, useState } from 'react'
import '../../styles/market-quotes.css'
import '../../styles/market-favorites.css'
import { AppIcon } from '../../components/AppIcon'
import { AssetAvatar, SectionHeader } from '../../components/ui'
import { getSettlementDate } from '../../game/settlement/settlementRules'
import type { AssetManifestItem, MarketCode } from '../../types/market'
import { useGameStore } from '../../stores/gameStore'
import { HelpLink } from '../help/HelpCenter'
import { TradingDialog } from '../trading/TradingDialog'
import { getVisibleAssets, getVisibleSectors, type AssetBrowserFilter } from './assetCatalog'
import { formatMarketPrice, marketQuoteSourceLabel } from './marketQuote'
import { useMarketCalendars } from './useMarketCalendars'
import { useMarketCatalog } from './useMarketCatalog'
import { useMarketQuotes } from './useMarketQuotes'

const filters: Array<{ id: AssetBrowserFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'KR', label: '한국' },
  { id: 'US', label: '미국' },
  { id: 'ETF', label: 'ETF' },
]

const marketLabels: Record<MarketCode, string> = { KR: '국내장', US: '미국장' }
const phaseLabels = { preopen: '개장 전', opened: '장중', closed: '마감' } as const

function assetSubtitle(asset: AssetManifestItem): string {
  return `${asset.id} · ${asset.sector}`
}

function changeClass(changeRate: number | null): string {
  if (changeRate === null || changeRate === 0) return ''
  return changeRate > 0 ? 'positive' : 'negative'
}

function formatChangeRate(changeRate: number | null): string {
  if (changeRate === null) return '—'
  return `${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}%`
}

export function MarketBrowser() {
  const game = useGameStore()
  const { assets } = useMarketCatalog()
  const { calendars } = useMarketCalendars()
  const [filter, setFilter] = useState<AssetBrowserFilter>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [sector, setSector] = useState('all')
  const [orderAsset, setOrderAsset] = useState<AssetManifestItem | null>(null)

  const sectors = useMemo(() => getVisibleSectors(assets, game.gameDate), [assets, game.gameDate])
  const favoriteAssetIds = useMemo(() => new Set(game.favoriteAssetIds), [game.favoriteAssetIds])
  const filteredAssets = useMemo(() => getVisibleAssets(assets, game.gameDate, filter, searchText, sector), [assets, filter, game.gameDate, searchText, sector])
  const visibleAssets = useMemo(
    () => favoritesOnly ? filteredAssets.filter((asset) => favoriteAssetIds.has(asset.id)) : filteredAssets,
    [favoriteAssetIds, favoritesOnly, filteredAssets],
  )
  const marketQuotes = useMarketQuotes(visibleAssets, game.gameDate, game.marketSessions)
  const openMarketNames = (['KR', 'US'] as const)
    .filter((market) => game.marketSessions[market].phase === 'opened')
    .map((market) => marketLabels[market])

  useEffect(() => {
    if (sector !== 'all' && !sectors.includes(sector)) setSector('all')
  }, [sector, sectors])

  const orderSession = orderAsset ? game.marketSessions[orderAsset.market] : null
  const orderTradingDate = orderSession?.tradingDate ?? game.gameDate
  const orderSettlementDate = orderAsset && calendars && orderSession?.phase === 'opened' && orderSession.tradingDate
    ? getSettlementDate(orderAsset.market, orderSession.tradingDate, calendars[orderAsset.market]) ?? undefined
    : undefined

  const selectAsset = (asset: AssetManifestItem) => {
    setOrderAsset(asset)
    game.markGuidanceExperience('asset-detail-viewed')
  }

  const flowLabel = `국내장 ${phaseLabels[game.marketSessions.KR.phase]} · 미국장 ${phaseLabels[game.marketSessions.US.phase]} · 장중인 시장의 종목만 주문 가능`
  const marketDescription = openMarketNames.length > 0
    ? `${visibleAssets.length}개 종목 · 현재 거래 가능 ${openMarketNames.join(' · ')}`
    : `${visibleAssets.length}개 종목 · 현재 거래 가능한 시장 없음`

  return (
    <main className="market-browser">
      <section className="screen-title-section">
        <SectionHeader title="시장" description={marketDescription} />
        <div className="market-session-actions"><HelpLink section="orders">주문 규칙</HelpLink></div>
        <p className="market-flow-guide">{flowLabel}</p>
      </section>

      <section className="market-browser-grid">
        <aside className="asset-browser-list" aria-label="투자 대상 목록">
          <div className="market-filter-row">
            <div className="segmented-control asset-filter-tabs" aria-label="시장 필터">
              {filters.map((item) => <button aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label}</button>)}
            </div>
            <button
              aria-label="즐겨찾기만 보기"
              aria-pressed={favoritesOnly}
              className={`favorite-filter-toggle${favoritesOnly ? ' active' : ''}`}
              onClick={() => setFavoritesOnly((value) => !value)}
              title="즐겨찾기만 보기"
              type="button"
            >
              <AppIcon name="star" size={18}/><span>즐겨찾기</span>
            </button>
          </div>
          <div className="market-search-row">
            <label className="asset-search"><span className="sr-only">종목 검색</span><input aria-label="종목 검색" onChange={(event) => setSearchText(event.target.value)} placeholder="종목 또는 산업군 검색" type="search" value={searchText} /></label>
            <label className="sector-filter"><span className="sr-only">산업군</span><select aria-label="산업군" value={sector} onChange={(event) => setSector(event.target.value)}><option value="all">전체 산업군</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>

          <div className="asset-list-scroll">
            {visibleAssets.length === 0 ? <div className="compact-empty-state"><strong>{favoritesOnly ? '즐겨찾기 조건에 맞는 종목이 없습니다.' : '조건에 맞는 종목이 없습니다.'}</strong></div> : visibleAssets.map((asset) => {
              const quote = marketQuotes[asset.id]
              const rate = quote?.changeRate ?? null
              const session = game.marketSessions[asset.market]
              const favorite = favoriteAssetIds.has(asset.id)
              return (
                <div className="asset-list-row" data-asset-id={asset.id} key={asset.id}>
                  <button aria-label={`${asset.alias} 주문 거래 열기`} className="asset-list-main" onClick={() => selectAsset(asset)} type="button">
                    <AssetAvatar market={asset.market} kind={asset.kind} />
                    <span className="asset-list-copy"><strong>{asset.alias}</strong><small>{assetSubtitle(asset)} · {phaseLabels[session.phase]}</small></span>
                    <span className="asset-list-quote" title={quote ? `${marketQuoteSourceLabel(quote.source)} · ${quote.priceDate}` : '가격 정보 불러오는 중'}>
                      <strong className="financial-amount">{quote ? formatMarketPrice(quote.price, asset.currency) : '—'}</strong>
                      <small className={changeClass(rate)}>{formatChangeRate(rate)}</small>
                      <AppIcon name="chevron" size={16}/>
                    </span>
                  </button>
                  <button
                    aria-label={`${asset.alias} 즐겨찾기 ${favorite ? '해제' : '추가'}`}
                    aria-pressed={favorite}
                    className={`asset-favorite-button${favorite ? ' active' : ''}`}
                    onClick={() => game.toggleFavoriteAsset(asset.id)}
                    title={favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    type="button"
                  >
                    <AppIcon name="star" size={19}/>
                  </button>
                </div>
              )
            })}
          </div>
        </aside>
      </section>

      <TradingDialog
        asset={orderAsset}
        gameDate={orderTradingDate}
        settlementDate={orderSettlementDate}
        initialSide="buy"
        onClose={() => setOrderAsset(null)}
      />
    </main>
  )
}
