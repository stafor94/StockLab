import { useEffect, useMemo, useState } from 'react'
import { AssetAvatar } from '../../components/ui'
import { marketDataClient } from '../../data/marketDataClient'
import { useGameStore } from '../../stores/gameStore'
import type { AssetManifestItem, AssetPriceSeries } from '../../types/market'
import { CandlestickChart } from './CandlestickChart'
import { getKnownFullBars } from './chartData'
import { formatMarketPrice, marketQuoteSourceLabel, selectMarketQuote } from './marketQuote'

interface AssetDetailProps {
  asset: AssetManifestItem | null
  gameDate: string
}

type PriceState = { status: 'idle' | 'loading'; series: null; message: null } | { status: 'ready'; series: AssetPriceSeries; message: null } | { status: 'unavailable'; series: null; message: string }

export function AssetDetail({ asset, gameDate }: AssetDetailProps) {
  const marketSessions = useGameStore((state) => state.marketSessions)
  const [priceState, setPriceState] = useState<PriceState>({ status: 'idle', series: null, message: null })

  useEffect(() => {
    if (!asset) { setPriceState({ status: 'idle', series: null, message: null }); return }
    let cancelled = false
    setPriceState({ status: 'loading', series: null, message: null })
    void marketDataClient.loadAssetPriceSeriesAtPath(asset.dataPath).then((series) => { if (!cancelled) setPriceState({ status: 'ready', series, message: null }) }).catch(() => { if (!cancelled) setPriceState({ status: 'unavailable', series: null, message: '아직 이 종목의 실제 가격 파일이 배포되지 않았습니다.' }) })
    return () => { cancelled = true }
  }, [asset])

  const session = asset ? marketSessions[asset.market] : marketSessions.KR
  const knownBars = useMemo(() => priceState.status === 'ready' ? getKnownFullBars(priceState.series.bars, gameDate, session) : [], [gameDate, priceState, session])
  const quote = priceState.status === 'ready' ? selectMarketQuote(priceState.series, gameDate, session) : null
  const currentBar = priceState.status === 'ready' && session.tradingDate ? priceState.series.bars.find((bar) => bar.date === session.tradingDate) : undefined

  if (!asset) return <section className="asset-detail empty-detail"><strong>종목을 선택하세요.</strong><p>현재 게임 날짜에 상장된 종목과 ETF만 표시됩니다.</p></section>
  const readySeries = priceState.status === 'ready' ? priceState.series : null
  const latestKnownBar = knownBars.at(-1)

  return (
    <section className="asset-detail" aria-label={`${asset.alias} 상세`}>
      <header className="asset-detail-header">
        <div className="asset-detail-identity"><AssetAvatar market={asset.market} kind={asset.kind}/><div><h2>{asset.alias}</h2><p>{asset.id} · {asset.sector}</p></div></div>
        <div className="asset-price-summary"><small>{quote ? marketQuoteSourceLabel(quote.source) : '가격'}</small><strong className="financial-amount">{quote ? formatMarketPrice(quote.price, asset.currency) : '—'}</strong>{quote?.changeRate !== null && quote?.changeRate !== undefined && <span className={quote.changeRate > 0 ? 'positive' : quote.changeRate < 0 ? 'negative' : ''}>{quote.changeRate > 0 ? '+' : ''}{quote.changeRate.toFixed(2)}%</span>}</div>
      </header>

      <div className="asset-meta-line"><span>{asset.market === 'KR' ? '한국' : '미국'} · {asset.kind === 'etf' ? 'ETF' : '주식'}</span><span>{asset.currency}</span><span>비조정 OHLC</span></div>
      {session.phase === 'closed' && currentBar && <div className="session-ohlc-grid" aria-label="최근 거래일 OHLC"><div><span>시가</span><strong>{formatMarketPrice(currentBar.open, asset.currency)}</strong></div><div><span>고가</span><strong>{formatMarketPrice(currentBar.high, asset.currency)}</strong></div><div><span>저가</span><strong>{formatMarketPrice(currentBar.low, asset.currency)}</strong></div><div><span>종가</span><strong>{formatMarketPrice(currentBar.close, asset.currency)}</strong></div></div>}
      {priceState.status === 'loading' && <div className="asset-data-state">가격 데이터를 불러오는 중입니다.</div>}
      {priceState.status === 'unavailable' && <div className="asset-data-state warning-state"><strong>가격 데이터 준비 중</strong><span>{priceState.message}</span></div>}

      <CandlestickChart bars={readySeries?.bars ?? []} gameDate={gameDate} currency={asset.currency} session={session}/>
      <div className="preopen-notice">{session.phase === 'preopen' && <>해당 시장 장 시작 전에는 현재 거래일 가격을 공개하지 않습니다.</>}{session.phase === 'opened' && <>장중에는 <strong>{session.tradingDate} 시가만 공개</strong>하며 이 시가로 주문할 수 있습니다. 고가·저가·종가는 마감까지 숨깁니다.</>}{session.phase === 'closed' && <>해당 시장이 마감되어 <strong>{latestKnownBar?.date ?? session.tradingDate ?? gameDate} 전체 OHLC</strong>가 공개되었습니다. 다음 개장 전까지 거래할 수 없습니다.</>}</div>
    </section>
  )
}
