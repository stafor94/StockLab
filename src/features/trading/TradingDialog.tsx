import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useModalFocus } from '../../components/useModalFocus'
import { marketDataClient } from '../../data/marketDataClient'
import { useGameStore } from '../../stores/gameStore'
import type { AssetManifestItem, AssetPriceSeries } from '../../types/market'
import { CandlestickChart } from '../market/CandlestickChart'
import { TradingPanel, type TradingSide } from './TradingPanel'
import '../../styles/trading-dialog.css'
import '../../styles/trading-dialog-controls.css'

interface TradingDialogProps {
  asset: AssetManifestItem | null
  gameDate: string
  settlementDate?: string
  initialSide?: TradingSide
  onClose: () => void
}

type PriceState =
  | { status: 'idle' | 'loading'; series: null; message: null }
  | { status: 'ready'; series: AssetPriceSeries; message: null }
  | { status: 'unavailable'; series: null; message: string }

export function TradingDialog({
  asset,
  gameDate,
  settlementDate,
  onClose,
}: TradingDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const open = Boolean(asset)
  const trapFocus = useModalFocus(open, closeButtonRef)
  const marketSessions = useGameStore((state) => state.marketSessions)
  const [priceState, setPriceState] = useState<PriceState>({ status: 'idle', series: null, message: null })
  const [selectedSide, setSelectedSide] = useState<TradingSide | null>(null)

  useEffect(() => {
    setSelectedSide(null)
  }, [asset?.id, gameDate])

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
            message: '이 종목의 실제 가격 데이터를 불러올 수 없어 주문할 수 없습니다.',
          })
        }
      })

    return () => { cancelled = true }
  }, [asset])

  if (!asset) return null

  const session = marketSessions[asset.market]
  const chartDisclosure = session.phase === 'preopen'
    ? '차트는 이전 마감 일봉까지만 표시합니다. 현재 거래일 OHLC는 개장 전 공개하지 않습니다.'
    : session.phase === 'opened'
      ? `차트는 이전 마감 일봉까지만 표시합니다. 장중에는 ${session.tradingDate ?? gameDate} 시가만 주문 가격으로 공개하고 고가·저가·종가는 마감까지 숨깁니다.`
      : `차트에 ${session.tradingDate ?? gameDate} 거래일의 전체 OHLC까지 반영했습니다.`

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      if (event.target instanceof Element && event.target.closest('.order-error-dialog')) return
      event.preventDefault()
      onClose()
      return
    }
    trapFocus(event)
  }

  const sideLabel = selectedSide === 'buy' ? '매수' : selectedSide === 'sell' ? '매도' : null

  return (
    <div className="trading-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        className="trading-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trading-dialog-title"
        onKeyDown={handleKeyDown}
      >
        <header className="trading-dialog-header">
          <div className="trading-dialog-header-main">
            {selectedSide && (
              <button
                className="trading-dialog-back"
                type="button"
                aria-label="주문 유형 선택으로 돌아가기"
                onClick={() => setSelectedSide(null)}
              >
                ←
              </button>
            )}
            <div className="trading-dialog-header-copy">
              <p className="section-kicker">ORDER</p>
              <h2 id="trading-dialog-title">{asset.alias} 주문 거래</h2>
              <span>{asset.id} · {asset.market === 'KR' ? '한국' : '미국'} · {asset.currency}{sideLabel ? ` · ${sideLabel} 주문` : ''}</span>
            </div>
          </div>
          <button ref={closeButtonRef} className="trading-dialog-close" type="button" aria-label="주문 거래 닫기" onClick={onClose}>×</button>
        </header>

        <div className="trading-dialog-body">
          {priceState.status === 'loading' && <div className="trading-dialog-state" role="status">가격 데이터를 불러오는 중입니다.</div>}
          {priceState.status === 'unavailable' && <div className="trading-dialog-state warning-state" role="alert">{priceState.message}</div>}
          {priceState.status === 'ready' && selectedSide === null && (
            <>
              <section className="trading-dialog-chart" aria-label={`${asset.alias} 가격 차트`}>
                <CandlestickChart
                  bars={priceState.series.bars}
                  gameDate={gameDate}
                  currency={asset.currency}
                  session={session}
                />
                <p className="trading-dialog-chart-note">{chartDisclosure}</p>
              </section>
              <section className="trading-side-selector" aria-label="주문 유형 선택">
                <div className="trading-side-selector-copy">
                  <strong>주문 방향을 선택하세요</strong>
                  <span>선택 후 해당 주문에 필요한 입력만 표시합니다.</span>
                </div>
                <div className="trading-side-actions">
                  <button className="buy" type="button" aria-label="매수" onClick={() => setSelectedSide('buy')}>
                    <strong>매수</strong>
                    <span>현금으로 종목 매수</span>
                  </button>
                  <button className="sell" type="button" aria-label="매도" onClick={() => setSelectedSide('sell')}>
                    <strong>매도</strong>
                    <span>보유 종목 매도</span>
                  </button>
                </div>
              </section>
            </>
          )}
          {priceState.status === 'ready' && selectedSide !== null && (
            <div className={`trading-order-detail ${selectedSide}`}>
              <TradingPanel
                key={`${asset.id}:${gameDate}:${selectedSide}`}
                asset={asset}
                gameDate={gameDate}
                series={priceState.series}
                settlementDate={settlementDate}
                initialSide={selectedSide}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
