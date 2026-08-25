import { useMemo, useState } from 'react'
import { getNextLoanPaymentDate } from '../../game/loan/loanEngine'
import {
  getWsLoanAnnualRate,
  getWsOverdueAnnualRate,
  WS_LOAN_MARGIN_PERCENTAGE_POINTS,
  WS_OVERDUE_PREMIUM_PERCENTAGE_POINTS,
  WS_OVERDUE_RATE_CAP,
  WS_PRINCIPAL_REPAYMENT_UNIT,
} from '../../game/loan/rateRules'
import { useGameStore } from '../../stores/gameStore'
import { useMarketCalendars } from '../market/useMarketCalendars'
import { useBaseRate } from './useBaseRate'

const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const rate = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const eventLabels = {
  interest_due: '이자 청구',
  interest_paid: '자동 납부',
  payment_failed: '자동출금 실패',
  principal_repayment: '원금 중도상환',
  paid_off: '대출 완납',
} as const

export function LoanScreen() {
  const game = useGameStore()
  const { calendars } = useMarketCalendars()
  const rateState = useBaseRate(game.gameDate)
  const [amountText, setAmountText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const amount = Number(amountText.replaceAll(',', ''))
  const totalPastDue = Math.ceil(game.loan.pastDueInterest + game.loan.overdueCharge)
  const accruedInterest = Math.ceil(game.loan.accruedInterest)

  const annualRate = useMemo(() => {
    if (rateState.status !== 'ready') return null
    try { return getWsLoanAnnualRate(rateState.series, game.gameDate) } catch { return null }
  }, [game.gameDate, rateState])
  const overdueAnnualRate = useMemo(() => {
    if (rateState.status !== 'ready') return null
    try { return getWsOverdueAnnualRate(rateState.series, game.gameDate) } catch { return null }
  }, [game.gameDate, rateState])
  const nextPaymentDate = useMemo(
    () => calendars ? getNextLoanPaymentDate(game.gameDate, game.loan.originationDate, calendars.KR.tradingDates) : null,
    [calendars, game.gameDate, game.loan.originationDate],
  )

  const repaymentDisabled = game.loan.status === 'paid'
    || game.loan.status === 'overdue'
    || game.marketSessionPhase !== 'preopen'
    || !Number.isFinite(amount)
    || amount <= 0

  const executeRepayment = () => {
    const result = game.repayLoanPrincipal(amount)
    setMessage(result.message)
    if (result.ok) setAmountText('')
  }

  return (
    <div className="loan-screen">
      <section className="panel loan-header">
        <div>
          <p className="section-label">WS BANK CREDIT LOAN</p>
          <h2>WS 직장인 신용대출</h2>
          <p>주식 투자를 위해 받은 1금융권 변동금리 신용대출입니다.</p>
        </div>
        <div className={`loan-status-badge ${game.loan.status}`}>
          <span>대출상태</span>
          <strong>{game.loan.status === 'current' ? '정상' : game.loan.status === 'overdue' ? '연체' : '완납'}</strong>
        </div>
      </section>

      {game.loan.status === 'overdue' && (
        <section className="panel loan-overdue-alert" role="alert">
          <strong>대출이자가 미납되었습니다.</strong>
          <span>미납액 ₩{krw.format(totalPastDue)} · 연속 {game.loan.consecutiveMissedMonths}개월</span>
          <p>원화 현금이 전액 준비된 다음 WS은행 영업일에 자동 재출금합니다. 미결제 매도대금과 달러는 사용할 수 없습니다.</p>
        </section>
      )}

      <section className="loan-summary-grid">
        <article className="panel loan-metric"><span>대출 원금</span><strong>₩{krw.format(game.loan.principal)}</strong><small>만기일시상환형</small></article>
        <article className="panel loan-metric"><span>현재 약정금리</span><strong>{annualRate === null ? '—' : `${rate.format(annualRate)}%`}</strong><small>기준금리 + {WS_LOAN_MARGIN_PERCENTAGE_POINTS.toFixed(1)}%p</small></article>
        <article className="panel loan-metric"><span>다음 이자일</span><strong>{game.loan.status === 'paid' ? '—' : nextPaymentDate ?? '데이터 범위 밖'}</strong><small>매월 첫 WS은행 영업일</small></article>
        <article className="panel loan-metric"><span>미청구 이자</span><strong>₩{krw.format(accruedInterest)}</strong><small>일할 계산 누적분</small></article>
      </section>

      <section className="loan-grid">
        <article className="panel loan-repayment-card">
          <div><p className="section-label">PRINCIPAL REPAYMENT</p><h3>원금 중도상환</h3></div>
          <div className="loan-cash-line"><span>상환 가능한 원화 현금</span><strong>₩{krw.format(game.krwCash)}</strong></div>
          <label className="loan-input">
            <span>상환할 원금</span>
            <div><b>₩</b><input aria-label="대출 원금 상환액" inputMode="numeric" value={amountText} onChange={(event) => { setAmountText(event.target.value); setMessage(null) }} placeholder="1,000,000" /></div>
          </label>
          <div className="loan-quick-actions">
            <button type="button" onClick={() => setAmountText(String(WS_PRINCIPAL_REPAYMENT_UNIT))}>100만원</button>
            <button type="button" onClick={() => setAmountText(String(WS_PRINCIPAL_REPAYMENT_UNIT * 3))}>300만원</button>
            <button type="button" onClick={() => setAmountText(String(game.loan.principal))}>전액</button>
          </div>
          {amount >= game.loan.principal && game.loan.principal > 0 && (
            <div className="loan-payoff-preview">전액상환 시 미청구 이자 약 ₩{krw.format(accruedInterest)}도 함께 정산됩니다.</div>
          )}
          <button className="loan-submit" type="button" disabled={repaymentDisabled} onClick={executeRepayment}>원금 상환</button>
          {game.loan.status === 'overdue' && <p className="loan-message warning">연체 중에는 원금 중도상환보다 미납 이자 자동출금이 우선됩니다.</p>}
          {message && <p className="loan-message" aria-live="polite">{message}</p>}
        </article>

        <aside className="panel loan-policy">
          <p className="section-label">LOAN POLICY</p>
          <h3>WS은행 적용 규칙</h3>
          <dl>
            <div><dt>금리</dt><dd>한국은행 기준 + 3.0%p</dd></div>
            <div><dt>이자 납입</dt><dd>매월 첫 영업일</dd></div>
            <div><dt>연체 가산</dt><dd>+{WS_OVERDUE_PREMIUM_PERCENTAGE_POINTS.toFixed(1)}%p</dd></div>
            <div><dt>최고 연체금리</dt><dd>{WS_OVERDUE_RATE_CAP.toFixed(0)}%</dd></div>
            <div><dt>재출금</dt><dd>이후 매 영업일</dd></div>
            <div><dt>게임 오버</dt><dd>3개월 연속 미납</dd></div>
          </dl>
          <p>연체이자는 미납된 약정이자에 대해 계산합니다. 원금은 100만원 단위로 중도상환할 수 있으며 중도상환수수료는 없습니다.</p>
          {overdueAnnualRate !== null && <small>현재 연체 적용금리 {rate.format(overdueAnnualRate)}%</small>}
        </aside>
      </section>

      <section className="panel loan-history">
        <div><p className="section-label">HISTORY</p><h3>대출 내역</h3></div>
        {game.loan.history.length === 0 ? <p>아직 이자 청구 또는 상환 내역이 없습니다.</p> : (
          <div className="loan-history-list">
            {game.loan.history.slice().reverse().slice(0, 30).map((event) => (
              <div key={event.id}><span>{event.date} · {event.id} · {eventLabels[event.type]}</span><strong>₩{krw.format(event.amount)}</strong><small>{event.note}</small></div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
