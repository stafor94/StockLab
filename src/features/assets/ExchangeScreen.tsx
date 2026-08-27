import { useMemo, useState } from 'react'
import {
  getFxSpreadRate,
  quoteExchange,
  WS_FX_BASE_SPREAD_RATE,
  WS_FX_EFFECTIVE_SPREAD_RATE,
  WS_FX_PREFERENTIAL_RATE,
} from '../../game/exchange/exchangeEngine'
import type { ExchangeDirection } from '../../game/exchange/types'
import { useGameStore } from '../../stores/gameStore'
import { formatMoney } from '../../utils/money'
import { useFxRate } from './useFxRate'

const usdMoney = (value: number) => formatMoney(value, 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const krwRate = (value: number) => formatMoney(value, 'KRW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ExchangeScreen() {
  const game = useGameStore()
  const { status, error, ratePoint } = useFxRate(game.gameDate)
  const [direction, setDirection] = useState<ExchangeDirection>('KRW_TO_USD')
  const [amountText, setAmountText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const amount = Number(amountText.replaceAll(',', ''))
  const spreadRate = getFxSpreadRate(game.marketSessions)
  const preferentialActive = spreadRate === WS_FX_EFFECTIVE_SPREAD_RATE
  const quote = useMemo(() => {
    if (!ratePoint || !Number.isFinite(amount) || amount <= 0) return null
    try { return quoteExchange({ direction, amount }, ratePoint.usdKrw, spreadRate) } catch { return null }
  }, [amount, direction, ratePoint, spreadRate])
  const disabled = status !== 'ready' || !ratePoint || !quote
  const execute = () => {
    if (!ratePoint || !quote) return
    const result = game.exchangeCash({ direction, amount }, ratePoint.usdKrw)
    setMessage(result.message)
    if (result.ok) setAmountText('')
  }

  return (
    <div className="exchange-screen">
      <section className="exchange-header"><div><h2>환전</h2><p>미국 주식 주문에 사용할 달러를 준비합니다.</p></div><div className="fx-source-badge"><span>기준환율</span><strong>한국은행 ECOS</strong></div></section>
      <section className="exchange-grid">
        <article className="exchange-card">
          <div className="cash-balance-grid"><div><span>원화 현금</span><strong>{formatMoney(game.krwCash, 'KRW')}</strong></div><div><span>달러 현금</span><strong>{usdMoney(game.usdCash)}</strong></div></div>
          <div className="segmented-control direction-tabs" aria-label="환전 방향"><button type="button" aria-pressed={direction === 'KRW_TO_USD'} className={direction === 'KRW_TO_USD' ? 'active' : ''} onClick={() => { setDirection('KRW_TO_USD'); setMessage(null) }}>원화 → 달러</button><button type="button" aria-pressed={direction === 'USD_TO_KRW'} className={direction === 'USD_TO_KRW' ? 'active' : ''} onClick={() => { setDirection('USD_TO_KRW'); setMessage(null) }}>달러 → 원화</button></div>
          <label className="exchange-input"><span>{direction === 'KRW_TO_USD' ? '환전할 원화' : '환전할 달러'}</span><div>{direction === 'USD_TO_KRW' && <b>$</b>}<input aria-label="환전 금액" inputMode="decimal" value={amountText} onChange={(event) => { setAmountText(event.target.value); setMessage(null) }} placeholder="0" />{direction === 'KRW_TO_USD' && <b>원</b>}</div></label>
          {status === 'unavailable' ? <div className="fx-unavailable"><strong>환율 데이터 준비 중</strong><span>{error}</span></div> : ratePoint ? <div className="rate-summary"><div><span>기준환율</span><strong>{krwRate(ratePoint.usdKrw)} / $1</strong></div><small>{ratePoint.date} 공표값 기준</small></div> : <div className="fx-unavailable"><strong>사용 가능한 환율 없음</strong><span>현재 게임 날짜 이전의 한국은행 환율이 필요합니다.</span></div>}
          {quote && <div className="exchange-quote"><div><span>적용 환율</span><strong>{krwRate(quote.appliedRate)}</strong></div><div><span>받는 금액</span><strong>{direction === 'KRW_TO_USD' ? usdMoney(quote.targetAmount) : formatMoney(quote.targetAmount, 'KRW')}</strong></div><small>스프레드 비용 약 {formatMoney(quote.feeEquivalentKrw, 'KRW')}</small></div>}
          <button className="primary-button exchange-submit" type="button" disabled={disabled} onClick={execute}>환전 실행</button>
          {message && <p className="exchange-message" aria-live="polite">{message}</p>}
        </article>
        <aside className="exchange-policy"><h3>환전 안내</h3><dl><div><dt>기본 스프레드</dt><dd>{(WS_FX_BASE_SPREAD_RATE * 100).toFixed(2)}%</dd></div><div><dt>환율 우대</dt><dd>{preferentialActive ? `${(WS_FX_PREFERENTIAL_RATE * 100).toFixed(0)}% 적용` : '미적용'}</dd></div><div><dt>현재 스프레드</dt><dd>{(spreadRate * 100).toFixed(2)}%</dd></div><div><dt>우대 적용 시간</dt><dd>국내장 장중</dd></div><div><dt>환전 가능 시간</dt><dd>항상</dd></div></dl><p>국내장이 열려 있을 때만 기본 스프레드에 95% 환율 우대를 적용합니다. 그 외 시간에는 기본 스프레드를 적용하며, 미국장 상태와 관계없이 환전할 수 있습니다.</p></aside>
      </section>
      <section className="exchange-history"><h3>환전 내역</h3>{game.exchangeHistory.length === 0 ? <p>아직 환전 내역이 없습니다.</p> : <div className="exchange-history-list">{game.exchangeHistory.slice().reverse().slice(0, 20).map((record) => <div key={record.id}><span>{record.date}</span><strong>{record.direction === 'KRW_TO_USD' ? `${formatMoney(record.sourceAmount, 'KRW')} → ${usdMoney(record.targetAmount)}` : `${usdMoney(record.sourceAmount)} → ${formatMoney(record.targetAmount, 'KRW')}`}</strong></div>)}</section>
    </div>
  )
}
