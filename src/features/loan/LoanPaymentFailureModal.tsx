import { useRef, type KeyboardEvent } from 'react'
import { useModalFocus } from '../../components/useModalFocus'
import { formatMoney } from '../../utils/money'
import type { LoanPaymentFailureAlert } from '../home/autoplayUiStore'

export function LoanPaymentFailureModal({
  alert,
  onConfirm,
  onOpenAssets,
}: {
  alert: LoanPaymentFailureAlert
  onConfirm: () => void
  onOpenAssets: () => void
}) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const trapFocus = useModalFocus(true, confirmButtonRef)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onConfirm()
      return
    }
    trapFocus(event)
  }

  return (
    <div className="loan-failure-backdrop" role="presentation">
      <section className="loan-failure-modal" role="alertdialog" aria-modal="true" aria-labelledby="loan-failure-title" aria-describedby="loan-failure-description" onKeyDown={handleKeyDown}>
        <p className="section-kicker danger-text">자동진행 중단</p>
        <h2 id="loan-failure-title">대출 자동출금 실패</h2>
        <p id="loan-failure-description">WS은행 대출이자 자동출금에 실패해 자동진행을 멈췄습니다.</p>
        <dl>
          <div><dt>발생일</dt><dd>{alert.date}</dd></div>
          <div><dt>미납 청구액</dt><dd>{formatMoney(alert.amount, 'KRW')}</dd></div>
          <div><dt>연속 미납</dt><dd>{alert.consecutiveMissedMonths}개월</dd></div>
        </dl>
        <p className="loan-failure-note">{alert.note}</p>
        <div className="loan-failure-actions">
          <button className="secondary-button" type="button" onClick={onOpenAssets}>자산 확인</button>
          <button ref={confirmButtonRef} className="primary-button" type="button" onClick={onConfirm}>확인</button>
        </div>
      </section>
    </div>
  )
}
