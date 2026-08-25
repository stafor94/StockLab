import { useEffect, useMemo, useState } from 'react'
import { AssetAvatar } from '../../components/ui'
import { marketDataClient } from '../../data/marketDataClient'
import { useGameStore } from '../../stores/gameStore'
import type { AssetManifestItem, AssetPriceSeries } from '../../types/market'
import { TradingPanel } from '../trading/TradingPanel'
import { CandlestickChart } from './CandlestickChart'
import { getKnownFullBars } from './chartData'

interface AssetDetailProps { asset: AssetManifestItem | null; gameDate: string }
type PriceState = { status: 'idle' | 'loading'; series: null; message: null } | { status: 'ready'; series: AssetPriceSeries; message: null } | { status: 'unavailable'; series: null; message: string }

function formatPrice(value: number, asset: AssetManifestItem): string {
  const formatted = new Intl.NumberFormat(asset.currency === 'KRW' ? 'ko-KR' : 'en-US', { maximumFractionDigits: asset.currency === 'KRW' ? 0 : 2 }).format(value)
  return asset.currency === 'KRW' ? `₩${formatted}` : `$${formatted}`
}

export function AssetDetail({ asset, gameDate }: AssetDetailProps) {
  const marketSessionPhase = useGameStore((state) => state.marketSessionPhase)
  const [priceState, setPriceState] = useState<PriceState>({ status: 'idle', series: null, message: null })

  useEffect(() => {
    if (!asset) { setPriceState({ status: 'idle', series: null, message: null }); return }
    let cancelled = false
    setPriceState({ status: 'loading', series: null, message: null })
    void marketDataClient.loadAssetPriceSeriesAtPath(asset.dataPath).then((series) => { if (!cancelled) setPriceState({ status: 'ready', series, message: null }) }).catch(() => { if (!cancelled) setPriceState({ status: 'unavailable', series: null, message: '아직 이 종목의 실제 가격 파일이 배포되지 않았습니다.' }) })
    return () => { cancelled = true }
  }, [asset])

  const knownBars = useMemo(() => priceState.status === 'ready' ? getKnownFullBars(priceState.series.bars, gameDate, marketSessionPhase) : [], [gameDate, marketSessionPhase, priceState])
  const previous = priceState.status === 'ready' ? [...priceState.series.bars].reverse().find((bar) => bar.date < gameDate) : undefined
  const today = priceState.status === 'ready' ? priceState.series.bars.find((bar) => bar.date === gameDate) : undefined
  const displayPrice = marketSessionPhase === 'closed' ? today?.close : marketSessionPhase === 'opened' ? today?.open : previous?.close
  const priceLabel = marketSessionPhase === 'closed' ? '오늘 종가' : marketSessionPhase === 'opened' ? '오늘 시가' : '최근 종가'
  const changeRate = displayPrice !== undefined && previous && previous.close !== 0 ? ((displayPrice - previous.close) / previous.close) * 100 : null

  if (!asset) return <section className="asset-detail empty-detail"><strong>종목을 선택하세요.</strong><p>현재 게임 날짜에 상장된 종목과 ETF만 표시됩니다.</p></section>
  const readySeries = priceState.status === 'ready' ? priceState.series : null
  const latestKnownBar = knownBars.at(-1)

  return (
    <section className="asset-detail" aria-label={`${asset.alias} 상세`}>
      <header className="asset-detail-header">
        <div className="asset-detail-identity"><AssetAvatar market={asset.market} kind={asset.kind}/><div><h2>{asset.alias}</h2><p>{asset.id} · {asset.sector}</p></div></div>
        <div className="asset-price-summary"><small>{priceLabel}</small><strong className="financial-amount">{displayPrice !== undefined ? formatPrice(displayPrice, asset) : '—'}</strong>{changeRate !== null && <span className={changeRate >= 0 ? 'positive' : 'negative'}>{changeRate >= 0 ? '+' : ''}{changeRate.toFixed(2)}%</span>}</div>
      </header>

      <div className="asset-meta-line"><span>{asset.market === 'KR' ? '한국' : '미국'} · {asset.kind === 'etf' ? 'ETF' : '주식'}</span><span>{asset.currency}</span><span>비조정 OHLC</span></div>
      {marketSessionPhase === 'closed' && today && <div className="session-ohlc-grid" aria-label="오늘 OHLC"><div><span>시가</span><strong>{formatPrice(today.open, asset)}</strong></div><div><span>고가</span><strong>{formatPrice(today.high, asset)}</strong></div><div><span>저가</span><strong>{formatPrice(today.low, asset)}</strong></div><div><span>종가</span><strong>{formatPrice(today.close, asset)}</strong></div></div>}
      {priceState.status === 'loading' && <div className="asset-data-state">가격 데이터를 불러오는 중입니다.</div>}
      {priceState.status === 'unavailable' && <div className="asset-data-state warning-state"><strong>가격 데이터 준비 중</strong><span>{priceState.message}</span></div>}
      <CandlestickChart bars={readySeries?.bars ?? []} gameDate={gameDate} currency={asset.currency} phase={marketSessionPhase}/>
      <div className="preopen-notice">{marketSessionPhase === 'preopen' && <>주문 전에는 <strong>{gameDate}</strong> 당일 가격을 공개하지 않습니다.</>}{marketSessionPhase === 'opened' && <>장중에는 <strong>당일 시가만 공개</strong>하며 고가·저가·종가는 마감까지 숨깁니다.</>}{marketSessionPhase === 'closed' && <>오늘 장이 마감되어 <strong>{latestKnownBar?.date ?? gameDate} 전체 OHLC</strong>가 공개되었습니다.</>}</div>
      <TradingPanel asset={asset} gameDate={gameDate} series={readySeries}/>
    </section>
  )
}
