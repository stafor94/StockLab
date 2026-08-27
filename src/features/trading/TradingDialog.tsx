import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useModalFocus } from '../../components/useModalFocus'
import { marketDataClient } from '../../data/marketDataClient'
import type { AssetManifestItem, AssetPriceSeries } from '../../types/market'
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
