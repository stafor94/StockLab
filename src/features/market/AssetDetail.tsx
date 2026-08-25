import { useEffect, useMemo, useState } from 'react'
import { marketDataClient } from '../../data/marketDataClient'
import type { AssetManifestItem, AssetPriceSeries } from '../../types/market'
import { TradingPanel } from '../trading/TradingPanel'
import { CandlestickChart } from './CandlestickChart'
import { getKnownBarsForPreOpen } from './chartData'

interface AssetDetailProps {
  asset: AssetManifestItem | null
  gameDate: string
}

type PriceState =
  | { status: 'idle' | 'loading'; series: null; message: null }
  | { status: 'ready'; series: AssetPriceSeries; message: null }
  | { status: 'unavailable'; series: null; message: string }

function formatPrice(value: number, asset: AssetManifestItem): string {
  const formatted = new Intl.NumberFormat(asset.currency === 'KRW' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: asset.currency === 'KRW' ? 0 : 2,
  }).format(value)
  return asset.currency === 'KRW' ? `₩${formatted}` : `$${formatted}`
}

export function AssetDetail({ asset, gameDate }: AssetDetailProps) {
  const [priceState, setPriceState] = useState<PriceState>({ status: 'idle', series: null, message: null })

  useEffect(() => {
    if (!asset) {
      setPriceState({ status: 'idle', series: null, message: null })
      return
    }

    let cancelled = false
    setPriceState({ status: 'loading', series: null, message: null })

    void marketDataClient.loadAssetPriceSeriesAtPath(asset.dataPath)
      .then((series) => {
        if (!cancelled) setPriceState({ status: 'ready', series, message: null })
      })
      .catch(() => {
        if (!cancelled) {
          setPriceState({
            status: 'unavailable',
            series: null,
            message: '아직 이 종목의 실제 가격 파일이 배포되지 않았습니다.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [asset])

  const knownBars = useMemo(
    () => priceState.status === 'ready'
      ? getKnownBarsForPreOpen(priceState.series.bars, gameDate)
      : [],
    [gameDate, priceState],
  )
  const latest = knownBars.at(-1)
  const previous = knownBars.at(-2)
  const changeRate = latest && previous && previous.close !== 0
    ? ((latest.close - previous.close) / previous.close) * 100
    : null

  if (!asset) {
    return (
      <section className="panel asset-detail empty-detail">
        <strong>종목을 선택하세요.</strong>
        <p>게임 날짜에 이미 상장된 종목과 ETF만 표시됩니다.</p>
      </section>
    )
  }

  const readySeries = priceState.status === 'ready' ? priceState.series : null

  return (
    <section className="panel asset-detail" aria-label={`${asset.alias} 상세`}>
      <header className="asset-detail-header">
        <div>
          <div className="asset-badges">
            <span>{asset.market === 'KR' ? '한국' : '미국'}</span>
            <span>{asset.kind === 'etf' ? 'ETF' : '주식'}</span>
          </div>
          <h2>{asset.alias}</h2>
          <p>{asset.sector}</p>
        </div>
        <div className="asset-price-summary">
          <small>개장 전 기준 최신 종가</small>
          <strong>{latest ? formatPrice(latest.close, asset) : '—'}</strong>
          {changeRate !== null && (
            <span className={changeRate >= 0 ? 'positive' : 'negative'}>
              {changeRate >= 0 ? '+' : ''}{changeRate.toFixed(2)}%
            </span>
          )}
        </div>
      </header>

      <div className="asset-meta-grid">
        <div><span>게임 ID</span><strong>{asset.id}</strong></div>
        <div><span>게임 내 등장일</span><strong>{asset.listedFrom}</strong></div>
        <div><span>통화</span><strong>{asset.currency}</strong></div>
        <div><span>가격 기준</span><strong>비조정 OHLC</strong></div>
      </div>

      {priceState.status === 'loading' && (
        <div className="asset-data-state">실제 일봉 데이터를 불러오는 중입니다.</div>
      )}
      {priceState.status === 'unavailable' && (
        <div className="asset-data-state warning-state">
          <strong>가격 데이터 준비 중</strong>
          <span>{priceState.message}</span>
        </div>
      )}

      <CandlestickChart
        bars={readySeries?.bars ?? []}
        gameDate={gameDate}
        currency={asset.currency}
      />

      <div className="preopen-notice">
        주문 전 화면에서는 <strong>{gameDate}</strong> 당일 시가·고가·저가·종가를 공개하지 않습니다.
      </div>

      <TradingPanel asset={asset} gameDate={gameDate} series={readySeries} />
    </section>
  )
}
