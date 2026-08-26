import { useMemo, useState } from 'react'
import type { AssetManifestItem, AssetPriceSeries } from '../../types/market'
import { useGameStore } from '../../stores/gameStore'
import type { MarketOrderKind } from '../../game/trading/types'
import { WS_BROKER_NAME } from '../../game/trading/wsBroker'
import { HelpLink } from '../help/HelpCenter'

interface TradingPanelProps {
  asset: AssetManifestItem
  gameDate: string
  series: AssetPriceSeries | null
}

type Side = 'buy' | 'sell'
type BuyMode = 'amount' | 'quantity'

function formatMoney(value: number, currency: 'KRW' | 'USD'): string {
  const formatted = new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(value)
  return currency === 'KRW' ? `₩${formatted}` : `$${formatted}`
}

function orderLabel(kind: MarketOrderKind, amount?: number, quantity?: number): string {
  if (kind === 'buy-amount') return `금액매수 ${amount?.toLocaleString() ?? 0}`
  if (kind === 'buy-quantity') return `수량매수 ${quantity ?? 0}주`
  if (kind === 'sell-all') return '전량매도'
  return `수량매도 ${quantity ?? 0}주`
}

export function TradingPanel({ asset, gameDate, series }: TradingPanelProps) {
  const game = useGameStore()
  const [side, setSide] = useState<Side>('buy')
  const [buyMode, setBuyMode] = useState<BuyMode>('amount')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const position = game.positions.find((item) => item.assetId === asset.id)
  const pendingOrders = game.pendingOrders.filter((order) => order.assetId === asset.id)
  const restriction = game.assetRestrictions[asset.id]
  const hasTodayBar = series?.bars.some((bar) => bar.date === gameDate) ?? false
  const canTrade = Boolean(series && hasTodayBar && game.marketSessionPhase === 'preopen' && !restriction?.halted && !restriction?.delisted)
  const settledCash = asset.currency === 'KRW' ? game.krwCash : game.usdCash

  const tradeDisabledReason = useMemo(() => {
    if (restriction?.delisted) return '상장폐지된 종목은 더 이상 주문할 수 없습니다.'
    if (restriction?.halted) return '현재 거래정지 중입니다. 거래재개 이벤트 이후 주문할 수 있습니다.'
    if (!series) return '실제 가격 데이터가 연결되어야 주문할 수 있습니다.'
    if (!hasTodayBar) return '이 시장은 오늘 거래일이 아니거나 가격 데이터가 없습니다.'
    if (game.marketSessionPhase === 'opened') return '오늘 시가 체결이 끝났습니다. 장 마감 후 다음 게임일에 다시 주문할 수 있습니다.'
    if (game.marketSessionPhase === 'closed') return '오늘 장이 마감되었습니다. 다음 게임일 개장 전에 다시 주문할 수 있습니다.'
    return null
  }, [game.marketSessionPhase, hasTodayBar, restriction?.delisted, restriction?.halted, series])

  const submit = (kind: MarketOrderKind) => {
    const parsedAmount = Number(amount.replaceAll(',', ''))
    const parsedQuantity = Number(quantity)
    const result = game.queueMarketOrder({
      assetId: asset.id,
      market: asset.market,
      currency: asset.currency,
      kind,
      requestedAmount: kind === 'buy-amount' ? parsedAmount : undefined,
      requestedQuantity: kind === 'buy-quantity' || kind === 'sell-quantity' ? parsedQuantity : undefined,
    })
    setMessage(result.message)
    if (result.ok) {
      setAmount('')
      setQuantity('')
    }
  }

  return (
    <section className="trading-panel" aria-label={`${asset.alias} 주문`}>
      <div className="trading-panel-heading">
        <div>
          <p className="section-label">MARKET ORDER</p>
          <h3>{WS_BROKER_NAME} 주문</h3>
        </div>
        <div className="settled-cash">
          <span>결제 완료 현금</span>
          <strong>{formatMoney(settledCash, asset.currency)}</strong>
        </div>
      </div>

      <div className="trade-side-tabs" aria-label="매수 매도 선택">
        <button className={side === 'buy' ? 'active' : ''} type="button" onClick={() => setSide('buy')}>매수</button>
        <button className={side === 'sell' ? 'active sell' : ''} type="button" onClick={() => setSide('sell')}>매도</button>
      </div>

      {side === 'buy' ? (
        <div className="order-form">
          <div className="buy-mode-tabs">
            <button className={buyMode === 'amount' ? 'active' : ''} type="button" onClick={() => setBuyMode('amount')}>금액으로</button>
            <button className={buyMode === 'quantity' ? 'active' : ''} type="button" onClick={() => setBuyMode('quantity')}>수량으로</button>
          </div>
          {buyMode === 'amount' ? (
            <label>
              <span>주문 금액 ({asset.currency})</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="예: 1000000" />
              <small>당일 실제 시가와 WS증권 수수료를 기준으로 살 수 있는 최대 정수 수량을 체결합니다.</small>
            </label>
          ) : (
            <label>
              <span>주문 수량</span>
              <input inputMode="numeric" min="1" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="1" />
              <small>시가 갭 상승으로 현금이 부족하면 주문 전체가 취소됩니다.</small>
            </label>
          )}
          <button className="trade-submit buy" disabled={!canTrade} type="button" onClick={() => submit(buyMode === 'amount' ? 'buy-amount' : 'buy-quantity')}>오늘 시가 매수 주문</button>
        </div>
      ) : (
        <div className="order-form">
          <div className="holding-summary"><span>보유 수량</span><strong>{position?.quantity ?? 0}주</strong></div>
          <label><span>매도 수량</span><input inputMode="numeric" min="1" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="1" /></label>
          <div className="sell-actions"><button disabled={!canTrade || !position} type="button" onClick={() => submit('sell-quantity')}>수량 매도</button><button className="danger" disabled={!canTrade || !position} type="button" onClick={() => submit('sell-all')}>전량 매도</button></div>
          <small className="settlement-note">매도대금은 시장별 결제일까지 미결제 상태이며, 매도일 기준 세금·규제비용과 WS증권 수수료를 차감한 순액만 결제됩니다. <HelpLink section="settlement" /></small>
        </div>
      )}

      {tradeDisabledReason && <p className="trade-disabled-reason">{tradeDisabledReason} <HelpLink section="orders" /></p>}
      {message && <p className="trade-message" aria-live="polite">{message}</p>}

      {pendingOrders.length > 0 && <div className="pending-order-list"><strong>오늘 미체결 주문 {pendingOrders.length}건</strong>{pendingOrders.map((order) => <div key={order.id}><span>{order.id} · {orderLabel(order.kind, order.requestedAmount, order.requestedQuantity)}</span><button type="button" onClick={() => game.cancelMarketOrder(order.id)}>취소</button></div>)}</div>}
    </section>
  )
}
