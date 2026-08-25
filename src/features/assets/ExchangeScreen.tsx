import { useMemo, useState } from 'react'
import {
  quoteExchange,
  WS_FX_BASE_SPREAD_RATE,
  WS_FX_EFFECTIVE_SPREAD_RATE,
  WS_FX_PREFERENTIAL_RATE,
} from '../../game/exchange/exchangeEngine'
import type { ExchangeDirection } from '../../game/exchange/types'
import { useGameStore } from '../../stores/gameStore'
import { useFxRate } from './useFxRate'

const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rateFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ExchangeScreen() {
  const game = useGameStore()
  const { status, error, ratePoint } = useFxRate(game.gameDate)
  const [direction, setDirection] = useState<ExchangeDirection>('KRW_TO_USD')
  const [amountText, setAmountText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const amount = Number(amountText.replaceAll(',', ''))
  const quote = useMemo(() => {
    if (!ratePoint || !Number.isFinite(amount) || amount <= 0) return null
    try { return quoteExchange({ direction, amount }, ratePoint.usdKrw) } catch { return null }
  }, [amount, direction, ratePoint])

  const disabled = status !== 'ready' || !ratePoint || !quote || game.marketSessionPhase !== 'preopen'
  const execute = () => {
    if (!ratePoint || !quote) return
    const result = game.exchangeCash({ direction, amount }, ratePoint.usdKrw)
    setMessage(result.message)
    if (result.ok) setAmountText('')
  }

  return (
    <div className="exchange-screen">
      <section className="panel exchange-header">
        <div><p className="section-label">WS SECURITIES FX</p><h2>원화 · 달러 환전</h2><p>미국 주식 주문 전 필요한 달러를 직접 준비합니다.</p></div>
        <div className="fx-source-badge"><span>공식 기준환율</span><strong>한국은행 ECOS</strong></div>
      </section>
      <section className="exchange-grid">
        <article className="panel exchange-card">
          <div className="cash-balance-grid"><div><span>원화 현금</span><strong>₩{krw.format(game.krwCash)}</strong></div><div><span>달러 현금</span><strong>${usd.format(game.usdCash)}</strong></div></div>
          <div className="direction-tabs" aria-label="환전 방향">
            <button type="button" className={direction === 'KRW_TO_USD' ? 'active' : ''} onClick={() => { setDirection('KRW_TO_USD'); setMessage(null) }}>원화 → 달러</button>
            <button type="button" className={direction === 'USD_TO_KRW' ? 'active' : ''} onClick={() => { setDirection('USD_TO_KRW'); setMessage(null) }}>달러 → 원화</button>
          </div>
          <label className="exchange-input"><span>{direction === 'KRW_TO_USD' ? '환전할 원화' : '환전할 달러'}</span><div><b>{direction === 'KRW_TO_USD' ? '₩' : '$'}</b><input aria-label="환전 금액" inputMode="decimal" value={amountText} onChange={(event) => { setAmountText(event.target.value); setMessage(null) }} placeholder="0" /></div></label>
          {status === 'unavailable' ? <div className="fx-unavailable"><strong>환율 데이터 준비 중</strong><span>{error}</span></div> : ratePoint ? <div className="rate-summary"><div><span>기준환율</span><strong>₩{rateFormat.format(ratePoint.usdKrw)} / $1</strong></div><small>{ratePoint.date} 한국은행 공표값 기준</small></div> : <div className="fx-unavailable"><strong>사용 가능한 환율 없음</strong><span>현재 게임 날짜 이전의 한국은행 환율이 필요합니다.</span></div>}
          {quote && <div className="exchange-quote"><div><span>적용 환율</span><strong>₩{rateFormat.format(quote.appliedRate)}</strong></div><div><span>받는 금액</span><strong>{direction === 'KRW_TO_USD' ? `$${usd.format(quote.targetAmount)}` : `₩${krw.format(quote.targetAmount)}`}</strong></div><small>우대 적용 비용 약 ₩{krw.format(quote.feeEquivalentKrw)}</small></div>}
          <button className="exchange-submit" type="button" disabled={disabled} onClick={execute}>환전 실행</button>
          {game.marketSessionPhase !== 'preopen' && <p className="exchange-message warning">장 시작 후에는 당일 환전을 할 수 없습니다.</p>}
          {message && <p className="exchange-message" aria-live="polite">{message}</p>}
        </article>
        <aside className="panel exchange-policy"><p className="section-label">FX POLICY</p><h3>WS증권 환전 정책</h3><dl><div><dt>기본 스프레드</dt><dd>{(WS_FX_BASE_SPREAD_RATE * 100).toFixed(2)}%</dd></div><div><dt>환율 우대</dt><dd>{(WS_FX_PREFERENTIAL_RATE * 100).toFixed(0)}%</dd></div><div><dt>실질 스프레드</dt><dd>{(WS_FX_EFFECTIVE_SPREAD_RATE * 100).toFixed(2)}%</dd></div><div><dt>환전 가능 시간</dt><dd>개장 전</dd></div></dl><p>원화→달러는 기준환율에 실질 스프레드를 더하고, 달러→원화는 차감합니다. 자동 환전은 하지 않습니다.</p></aside>
      </section>
      <section className="panel exchange-history"><div><p className="section-label">HISTORY</p><h3>환전 내역</h3></div>{game.exchangeHistory.length === 0 ? <p>아직 환전 내역이 없습니다.</p> : <div className="exchange-history-list">{game.exchangeHistory.slice().reverse().slice(0, 20).map((record) => <div key={record.id}><span>{record.date} · {record.id}</span><strong>{record.direction === 'KRW_TO_USD' ? `₩${krw.format(record.sourceAmount)} → $${usd.format(record.targetAmount)}` : `$${usd.format(record.sourceAmount)} → ₩${krw.format(record.targetAmount)}`}</strong></div>)}</div>}</section>
    </div>
  )
}
