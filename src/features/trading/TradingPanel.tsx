import { useEffect, useMemo, useState } from 'react'
import type { AssetManifestItem, AssetPriceSeries } from '../../types/market'
import { useGameStore } from '../../stores/gameStore'
import type { MarketOrderKind, MarketSessionExecutionPrice } from '../../game/trading/types'
import {
  calculateBuyCashRequired,
  calculateMaxAffordableQuantity,
  calculateSellProceeds,
  WS_BROKER_NAME,
} from '../../game/trading/wsBroker'
import { formatMoney } from '../../utils/money'
import { OrderErrorDialog } from './OrderErrorDialog'
import { removeLastInputCharacter } from './orderInput'

export type TradingSide = 'buy' | 'sell'

interface TradingPanelProps {
  asset: AssetManifestItem
  gameDate: string
  series: AssetPriceSeries | null
  settlementDate?: string
  initialSide?: TradingSide
}

type BuyMode = 'quantity' | 'amount'

function orderLabel(kind: MarketOrderKind, amount?: number, quantity?: number): string {
  if (kind === 'buy-amount') return `금액매수 ${amount?.toLocaleString() ?? 0}`
  if (kind === 'buy-quantity') return `수량매수 ${quantity ?? 0}주`
  if (kind === 'sell-all') return '전량매도'
  return `수량매도 ${quantity ?? 0}주`
}

function parseAmount(value: string): number {
  return Number(value.replaceAll(',', ''))
}

function parseQuantity(value: string): number {
  return Number(value)
}

function sessionPriceLabel(source: MarketSessionExecutionPrice): string {
  return source === 'open' ? '시가' : '종가'
}

export function TradingPanel({ asset, gameDate, series, settlementDate, initialSide = 'buy' }: TradingPanelProps) {
  const game = useGameStore()
  const [side, setSide] = useState<TradingSide>(initialSide)
  const [buyMode, setBuyMode] = useState<BuyMode>('quantity')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setAmount('')
    setQuantity('')
    setMessage(null)
    setErrorMessage(null)
    setSide(initialSide)
    setBuyMode('quantity')
  }, [asset.id, gameDate, initialSide])

  const session = game.marketSessions[asset.market]
  const tradingDate = session.tradingDate ?? gameDate
  const position = game.positions.find((item) => item.assetId === asset.id)
  const pendingOrders = game.pendingOrders.filter((order) => order.assetId === asset.id)
  const restriction = game.assetRestrictions[asset.id]
  const todayBar = series?.bars.find((bar) => bar.date === tradingDate)
  const openPrice = todayBar?.open
  const hasTodayBar = Boolean(todayBar)
  const priceSource: MarketSessionExecutionPrice = 'open'
  const executionPrice = session.phase === 'opened' ? openPrice : undefined
  const executionPriceLabel = sessionPriceLabel(priceSource)
  const settledCash = asset.currency === 'KRW' ? game.krwCash : game.usdCash
  const holdingQuantity = position?.quantity ?? 0
  const parsedAmount = parseAmount(amount)
  const parsedQuantity = parseQuantity(quantity)

  const buyQuantity = useMemo(() => {
    if (!executionPrice) return 0
    if (buyMode === 'quantity') return Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return 0
    return calculateMaxAffordableQuantity(Math.min(parsedAmount, settledCash), executionPrice, asset.market, asset.currency)
  }, [asset.currency, asset.market, buyMode, executionPrice, parsedAmount, parsedQuantity, settledCash])

  const buyPreview = useMemo(() => {
    if (!executionPrice || buyQuantity <= 0) return null
    return calculateBuyCashRequired(buyQuantity, executionPrice, asset.market, asset.currency)
  }, [asset.currency, asset.market, buyQuantity, executionPrice])

  const sellQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0
  const sellPreview = useMemo(() => {
    if (!executionPrice || sellQuantity <= 0 || sellQuantity > holdingQuantity) return null
    return calculateSellProceeds(sellQuantity, executionPrice, asset.id, asset.market, asset.currency, tradingDate)
  }, [asset.currency, asset.id, asset.market, executionPrice, holdingQuantity, sellQuantity, tradingDate])

  const canTrade = Boolean(
    series
    && hasTodayBar
    && executionPrice
    && session.phase === 'opened'
    && !restriction?.halted
    && !restriction?.delisted,
  )

  const tradeDisabledReason = useMemo(() => {
    if (restriction?.delisted) return '상장폐지된 종목은 더 이상 주문할 수 없습니다.'
    if (restriction?.halted) return '현재 거래정지 중입니다. 거래재개 이벤트 이후 주문할 수 있습니다.'
    if (!series) return '실제 가격 데이터가 연결되어야 주문할 수 있습니다.'
    if (session.phase === 'preopen') return '해당 시장의 장이 시작되기 전입니다. 홈의 다음 시장 이벤트에서 개장한 뒤 주문할 수 있습니다.'
    if (session.phase === 'closed') return '해당 시장은 마감되었습니다. 다음 거래일 개장 전까지 주문할 수 없습니다.'
    if (!hasTodayBar) return '현재 거래일의 가격 데이터를 확인할 수 없어 주문할 수 없습니다.'
    if (!executionPrice) return `현재 거래일 ${executionPriceLabel}를 확인할 수 없어 주문할 수 없습니다.`
    return null
  }, [executionPrice, executionPriceLabel, hasTodayBar, restriction?.delisted, restriction?.halted, series, session.phase])

  const submit = (kind: MarketOrderKind) => {
    if (!executionPrice) return
    const result = game.executeSessionPriceOrder({
      assetId: asset.id,
      market: asset.market,
      currency: asset.currency,
      kind,
      requestedAmount: kind === 'buy-amount' ? parsedAmount : undefined,
      requestedQuantity: kind === 'buy-quantity' || kind === 'sell-quantity' ? parsedQuantity : undefined,
    }, executionPrice, priceSource, settlementDate)

    if (!result.ok) {
      setMessage(null)
      setErrorMessage(result.message)
      return
    }

    setErrorMessage(null)
    setMessage(result.message)
    setAmount('')
    setQuantity('')
  }

  const addQuantity = (increment: number) => {
    const current = Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0
    setQuantity(String(current + increment))
  }

  const setSellRatio = (ratio: number) => {
    if (holdingQuantity <= 0) return
    setQuantity(String(ratio >= 1 ? holdingQuantity : Math.max(1, Math.floor(holdingQuantity * ratio))))
  }

  const maxBuyQuantity = executionPrice
    ? calculateMaxAffordableQuantity(settledCash, executionPrice, asset.market, asset.currency)
    : 0

  return (
    <section className="trading-panel" aria-label={`${asset.alias} 주문`}>
      <div className="trading-panel-heading">
        <div>
          <p className="section-label">SESSION PRICE ORDER</p>
          <h3>{WS_BROKER_NAME} 시가 주문</h3>
        </div>
        <div className="settled-cash">
          <span>주문 가능 현금</span>
          <strong>{formatMoney(settledCash, asset.currency)}</strong>
        </div>
      </div>

      {session.phase !== 'opened' ? (
        <div className="open-price-gate">
          <div><strong>{session.phase === 'closed' ? '해당 시장 마감' : '해당 시장 개장 전'}</strong><span>{session.phase === 'closed' ? '공식 종가는 가격 상태에 반영되지만 마감 후 주문은 받지 않습니다.' : '홈의 다음 시장 이벤트에서 해당 시장이 개장하면 실제 시가로 거래할 수 있습니다.'}</span></div>
        </div>
      ) : null}

      {session.phase === 'opened' && executionPrice ? (
        <div className="open-price-strip">
          <div><span>{tradingDate} 체결 시가</span><strong>{formatMoney(executionPrice, asset.currency)}</strong></div>
          <div><span>보유 수량</span><strong>{holdingQuantity.toLocaleString()}주</strong></div>
        </div>
      ) : null}

      <div className="trade-side-tabs" aria-label="매수 매도 선택">
        <button className={side === 'buy' ? 'active' : ''} type="button" onClick={() => { setSide('buy'); setQuantity(''); setMessage(null); setErrorMessage(null) }}>매수</button>
        <button className={side === 'sell' ? 'active sell' : ''} type="button" onClick={() => { setSide('sell'); setQuantity(''); setMessage(null); setErrorMessage(null) }}>매도</button>
      </div>

      {side === 'buy' ? (
        <div className="order-form">
          <div className="buy-mode-tabs">
            <button className={buyMode === 'quantity' ? 'active' : ''} type="button" onClick={() => setBuyMode('quantity')}>수량으로</button>
            <button className={buyMode === 'amount' ? 'active' : ''} type="button" onClick={() => setBuyMode('amount')}>금액으로</button>
          </div>

          {buyMode === 'quantity' ? (
            <>
              <label>
                <span>매수 수량</span>
                <input inputMode="numeric" min="1" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="예: 100" />
              </label>
              <div className="quantity-quick-actions buy-quick-actions" aria-label="매수 수량 빠른 입력">
                <button type="button" onClick={() => addQuantity(1)}>+1주</button>
                <button type="button" onClick={() => addQuantity(10)}>+10주</button>
                <button type="button" onClick={() => addQuantity(100)}>+100주</button>
                <button type="button" disabled={maxBuyQuantity <= 0} onClick={() => setQuantity(String(maxBuyQuantity))}>최대</button>
                <button className="backspace-action" type="button" aria-label="한 자리 지우기" onClick={() => setQuantity(removeLastInputCharacter)}>←</button>
              </div>
            </>
          ) : (
            <label>
              <span>사용할 금액 ({asset.currency})</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="예: 1000000" />
              <small>입력 금액 안에서 수수료까지 포함해 살 수 있는 최대 정수 수량을 자동 계산합니다.</small>
            </label>
          )}

          <div className="order-preview" aria-live="polite">
            <div><span>체결 수량</span><strong>{buyQuantity > 0 ? `${buyQuantity.toLocaleString()}주` : '—'}</strong></div>
            <div><span>주식 금액</span><strong>{buyPreview ? formatMoney(buyPreview.grossAmount, asset.currency) : '—'}</strong></div>
            <div><span>수수료</span><strong>{buyPreview ? formatMoney(buyPreview.commission, asset.currency) : '—'}</strong></div>
            <div className="order-preview-total"><span>총 필요 금액</span><strong>{buyPreview ? formatMoney(buyPreview.total, asset.currency) : '—'}</strong></div>
          </div>

          <button className="trade-submit buy" disabled={!canTrade || !buyPreview} type="button" onClick={() => submit(buyMode === 'amount' ? 'buy-amount' : 'buy-quantity')}>
            {buyPreview ? `${buyQuantity.toLocaleString()}주 시가 매수 · ${formatMoney(buyPreview.total, asset.currency)}` : '수량 또는 금액을 입력하세요'}
          </button>
        </div>
      ) : (
        <div className="order-form">
          <div className="holding-summary"><span>현재 보유</span><strong>{holdingQuantity.toLocaleString()}주</strong></div>
          <label><span>매도 수량</span><input inputMode="numeric" min="1" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="예: 100" /></label>
          <div className="quantity-quick-actions sell-quick-actions" aria-label="매도 수량 빠른 입력">
            <button disabled={holdingQuantity <= 0} type="button" onClick={() => setSellRatio(0.25)}>25%</button>
            <button disabled={holdingQuantity <= 0} type="button" onClick={() => setSellRatio(0.5)}>50%</button>
            <button disabled={holdingQuantity <= 0} type="button" onClick={() => setSellRatio(1)}>전량</button>
            <button className="backspace-action" type="button" aria-label="한 자리 지우기" onClick={() => setQuantity(removeLastInputCharacter)}>←</button>
          </div>

          <div className="order-preview" aria-live="polite">
            <div><span>매도 금액</span><strong>{sellPreview ? formatMoney(sellPreview.grossAmount, asset.currency) : '—'}</strong></div>
            <div><span>수수료·세금</span><strong>{sellPreview ? formatMoney(sellPreview.totalFees, asset.currency) : '—'}</strong></div>
            <div className="order-preview-total"><span>예상 정산액</span><strong>{sellPreview ? formatMoney(sellPreview.net, asset.currency) : '—'}</strong></div>
          </div>

          <button className="trade-submit sell" disabled={!canTrade || !sellPreview} type="button" onClick={() => submit('sell-quantity')}>
            {sellPreview ? `${sellQuantity.toLocaleString()}주 시가 매도 · ${formatMoney(sellPreview.net, asset.currency)}` : '매도 수량을 입력하세요'}
          </button>
          <small className="settlement-note">매도대금은 시장별 결제일까지 미결제 상태이며, 매도일 기준 세금·규제비용과 {WS_BROKER_NAME} 수수료를 차감한 순액만 결제됩니다.</small>
        </div>
      )}

      {tradeDisabledReason && <p className="trade-disabled-reason">{tradeDisabledReason}</p>}
      {message && <p className="trade-message" aria-live="polite">{message}</p>}

      {pendingOrders.length > 0 && (
        <div className="pending-order-list">
          <strong>기존 개장 전 예약 주문 {pendingOrders.length}건</strong>
          <small>예약 주문은 해당 시장의 다음 개장 시 실제 시가로 처리됩니다.</small>
          {pendingOrders.map((order) => <div key={order.id}><span>{order.id} · {orderLabel(order.kind, order.requestedAmount, order.requestedQuantity)}</span><button type="button" onClick={() => game.cancelMarketOrder(order.id)}>취소</button></div>)}
        </div>
      )}

      <OrderErrorDialog message={errorMessage} onClose={() => setErrorMessage(null)} />
    </section>
  )
}
