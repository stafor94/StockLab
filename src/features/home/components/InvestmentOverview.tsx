import { formatMoney } from '../../../utils/money'

interface InvestmentOverviewProps {
  totalAssets: number | null
  netAssets: number | null
  returnRate: number | null
  returnBadgeLabel: string
  krwCash: number
  usdCash: number
  unsettledKrw: number
  unsettledUsd: number
  loanPrincipal: number
  loanStatus: 'current' | 'overdue' | 'paid'
  loanSubtitle: string
}

function krwMoney(value: number | null) {
  return value === null ? '평가 대기' : formatMoney(Math.round(value), 'KRW')
}

const usdMoney = (value: number) => formatMoney(value, 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function InvestmentOverview(props: InvestmentOverviewProps) {
  const returnTone = (props.returnRate ?? 0) >= 0 ? 'positive' : 'negative'
  return (
    <section className="investment-overview" aria-labelledby="investment-title">
      <p className="section-kicker" id="investment-title">내 투자</p>
      <div className="investment-summary-row">
        <div className="investment-headline">
          <span>총자산</span>
          <strong className="financial-amount financial-amount-display">{krwMoney(props.totalAssets)}</strong>
          <div className="investment-performance">
            <span className={returnTone}>{props.returnRate === null ? '수익률 계산 중' : `${props.returnRate >= 0 ? '+' : ''}${props.returnRate.toFixed(2)}%`}</span>
            <span aria-hidden="true">·</span><span>{props.returnBadgeLabel}</span>
          </div>
        </div>
        <div className="investment-net-compact" aria-label="순자산">
          <span>순자산</span>
          <strong className="financial-amount">{krwMoney(props.netAssets)}</strong>
        </div>
        <div className="investment-cash-compact" aria-label="현금">
          <span>현금</span>
          <div className="investment-cash-values">
            <strong className="financial-amount">{formatMoney(props.krwCash, 'KRW')}</strong>
            {props.unsettledKrw > 0 && <small>미결제 {formatMoney(props.unsettledKrw, 'KRW')}</small>}
            <strong className="financial-amount">{usdMoney(props.usdCash)}</strong>
            {props.unsettledUsd > 0 && <small>미결제 {usdMoney(props.unsettledUsd)}</small>}
          </div>
        </div>
        <div className={`investment-loan-compact ${props.loanStatus === 'overdue' ? 'is-danger' : ''}`} aria-label="대출">
          <span>대출</span>
          <strong className="financial-amount">{formatMoney(props.loanPrincipal, 'KRW')}</strong>
        </div>
      </div>
    </section>
  )
}
