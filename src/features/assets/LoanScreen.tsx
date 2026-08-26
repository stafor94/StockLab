import { useMemo, useState } from 'react'
import { getNextLoanPaymentDate } from '../../game/loan/loanEngine'
import { getWsLoanAnnualRate, getWsOverdueAnnualRate, WS_LOAN_MARGIN_PERCENTAGE_POINTS, WS_OVERDUE_PREMIUM_PERCENTAGE_POINTS, WS_OVERDUE_RATE_CAP, WS_PRINCIPAL_REPAYMENT_UNIT } from '../../game/loan/rateRules'
import { useGameStore } from '../../stores/gameStore'
import { formatMoney } from '../../utils/money'
import { useMarketCalendars } from '../market/useMarketCalendars'
import { useBaseRate } from './useBaseRate'

const rate = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eventLabels = { interest_due: '이자 청구', interest_paid: '자동 납부', payment_failed: '자동출금 실패', principal_repayment: '원금 중도상환', paid_off: '대출 완납' } as const

export function LoanScreen() {
  const game = useGameStore()
  const { calendars } = useMarketCalendars()
  const rateState = useBaseRate(game.gameDate)
  const [amountText, setAmountText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const amount = Number(amountText.replaceAll(',', ''))
  const totalPastDue = Math.ceil(game.loan.pastDueInterest + game.loan.overdueCharge)
  const accruedInterest = Math.ceil(game.loan.accruedInterest)
  const annualRate = useMemo(() => { if (rateState.status !== 'ready') return null; try { return getWsLoanAnnualRate(rateState.series, game.gameDate) } catch { return null } }, [game.gameDate, rateState])
  const overdueAnnualRate = useMemo(() => { if (rateState.status !== 'ready') return null; try { return getWsOverdueAnnualRate(rateState.series, game.gameDate) } catch { return null } }, [game.gameDate, rateState])
  const nextPaymentDate = useMemo(() => calendars ? getNextLoanPaymentDate(game.gameDate, game.loan.originationDate, calendars.KR.tradingDates) : null, [calendars, game.gameDate, game.loan.originationDate])
  const repaymentDisabled = game.loan.status === 'paid' || game.loan.status === 'overdue' || game.marketSessionPhase !== 'preopen' || !Number.isFinite(amount) || amount <= 0
  const executeRepayment = () => { const result = game.repayLoanPrincipal(amount); setMessage(result.message); if (result.ok) setAmountText('') }

  return (
    <div className="loan-screen">
      <section className="loan-header"><div><h2>WS은행 대출</h2><p>변동금리 신용대출의 잔액과 상환 일정을 관리합니다.</p></div><div className={`loan-status-badge ${game.loan.status}`}><span>상태</span><strong>{game.loan.status === 'current' ? '정상' : game.loan.status === 'overdue' ? '연체' : '완납'}</strong></div></section>
      {game.loan.status === 'overdue' && <section className="loan-overdue-alert" role="alert"><strong>대출이자가 미납되었습니다.</strong><span>미납액 {formatMoney(totalPastDue, 'KRW')} · 연속 {game.loan.consecutiveMissedMonths}개월</span><p>원화 현금이 전액 준비된 다음 WS은행 영업일에 자동 재출금합니다. 미결제 매도대금과 달러는 사용할 수 없습니다.</p></section>}
      <section className="loan-summary-grid"><article><span>대출 원금</span><strong>{formatMoney(game.loan.principal, 'KRW')}</strong></article><article><span>현재 약정금리</span><strong>{annualRate === null ? '—' : `${rate.format(annualRate)}%`}</strong></article><article><span>다음 이자일</span><strong>{game.loan.status === 'paid' ? '—' : nextPaymentDate ?? '확인 불가'}</strong></article><article><span>미청구 이자</span><strong>{formatMoney(accruedInterest, 'KRW')}</strong></article></section>
      <section className="loan-grid">
        <article className="loan-repayment-card"><h3>원금 중도상환</h3><div className="loan-cash-line"><span>상환 가능한 원화 현금</span><strong>{formatMoney(game.krwCash, 'KRW')}</strong></div><label className="loan-input"><span>상환할 원금</span><div><input aria-label="대출 원금 상환액" inputMode="numeric" value={amountText} onChange={(event) => { setAmountText(event.target.value); setMessage(null) }} placeholder="1,000,000" /><b>원</b></div></label><div className="loan-quick-actions"><button type="button" onClick={() => setAmountText(String(WS_PRINCIPAL_REPAYMENT_UNIT))}>100만원</button><button type="button" onClick={() => setAmountText(String(WS_PRINCIPAL_REPAYMENT_UNIT * 3))}>300만원</button><button type="button" onClick={() => setAmountText(String(game.loan.principal))}>전액</button></div>{amount >= game.loan.principal && game.loan.principal > 0 && <div className="loan-payoff-preview">전액상환 시 미청구 이자 약 {formatMoney(accruedInterest, 'KRW')}도 함께 정산됩니다.</div>}<button className="primary-button loan-submit" type="button" disabled={repaymentDisabled} onClick={executeRepayment}>원금 상환</button>{game.loan.status === 'overdue' && <p className="loan-message warning">연체 중에는 원금 중도상환보다 미납 이자 자동출금이 우선됩니다.</p>}{message && <p className="loan-message" aria-live="polite">{message}</p>}</article>
        <aside className="loan-policy"><h3>대출 안내</h3><dl><div><dt>금리</dt><dd>한국은행 기준 + {WS_LOAN_MARGIN_PERCENTAGE_POINTS.toFixed(1)}%p</dd></div><div><dt>이자 납입</dt><dd>매월 첫 영업일</dd></div><div><dt>연체 가산</dt><dd>+{WS_OVERDUE_PREMIUM_PERCENTAGE_POINTS.toFixed(1)}%p</dd></div><div><dt>최고 연체금리</dt><dd>{WS_OVERDUE_RATE_CAP.toFixed(0)}%</dd></div><div><dt>재출금</dt><dd>이후 매 영업일</dd></div><div><dt>게임 오버</dt><dd>3개월 연속 미납</dd></div></dl><p>연체이자는 미납된 약정이자에 대해 계산합니다. 원금은 100만원 단위로 중도상환할 수 있으며 중도상환수수료는 없습니다.</p>{overdueAnnualRate !== null && <small>현재 연체 적용금리 {rate.format(overdueAnnualRate)}%</small>}</aside>
      </section>
      <section className="loan-history"><h3>대출 내역</h3>{game.loan.history.length === 0 ? <p>아직 이자 청구 또는 상환 내역이 없습니다.</p> : <div className="loan-history-list">{game.loan.history.slice().reverse().slice(0, 30).map((event) => <div key={event.id}><span>{event.date} · {eventLabels[event.type]}</span><strong>{formatMoney(event.amount, 'KRW')}</strong><small>{event.note}</small></div>)}</div>}</section>
    </div>
  )
}
