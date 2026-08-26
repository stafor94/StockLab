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
  onStartMarket?: () => void
  startingMarket?: boolean
}

type PriceState =
  | { status: 'idle' | 'loading'; series: null; message: null }
  | { status: 'ready'; series: AssetPriceSeries; message: null }
  | { status: 'unavailable'; series: null; message: string }

export function TradingDialog({
  asset,
  gameDate,
  settlementDate,
  initialSide = 'buy',
  onClose,
  onStartMarket,
  startingMarket = false,
}: TradingDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const open = Boolean(asset)
  const trapFocus = useModalFocus(open, closeButtonRef)
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
            message: '이 종목의 실제 가격 데이터를 불러올 수 없어 주문할 수 없습니다.',
          })
        }
      })

    return () => { cancelled = true }
  }, [asset])

  if (!asset) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    trapFocus(event)
  }

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
          <div>
            <p className="section-kicker">ORDER</p>
            <h2 id="trading-dialog-title">{asset.alias} 주문 거래</h2>
            <span>{asset.id} · {asset.market === 'KR' ? '한국' : '미국'} · {asset.currency}</span>
          </div>
          <button ref={closeButtonRef} className="trading-dialog-close" type="button" aria-label="주문 거래 닫기" onClick={onClose}>×</button>
        </header>

        <div className="trading-dialog-body">
          {priceState.status === 'loading' && <div className="trading-dialog-state" role="status">가격 데이터를 불러오는 중입니다.</div>}
          {priceState.status === 'unavailable' && <div className="trading-dialog-state warning-state" role="alert">{priceState.message}</div>}
          {priceState.status === 'ready' && (
            <TradingPanel
              asset={asset}
              gameDate={gameDate}
              series={priceState.series}
              settlementDate={settlementDate}
              initialSide={initialSide}
              onStartMarket={onStartMarket}
              startingMarket={startingMarket}
            />
          )}
        </div>
      </section>
    </div>
  )
}
