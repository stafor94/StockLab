import { SectionHeader } from '../../../components/ui'

const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  return value === null ? '평가 대기' : `₩${krw.format(Math.round(value))}`
}

export function InvestmentOverview(props: InvestmentOverviewProps) {
  const returnTone = (props.returnRate ?? 0) >= 0 ? 'positive' : 'negative'
  return (
    <>
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
              <div>
                <span>원화</span>
                <strong className="financial-amount">₩{krw.format(props.krwCash)}</strong>
                {props.unsettledKrw > 0 && <small>미결제 ₩{krw.format(props.unsettledKrw)}</small>}
              </div>
              <div>
                <span>달러</span>
                <strong className="financial-amount">${usd.format(props.usdCash)}</strong>
                {props.unsettledUsd > 0 && <small>미결제 ${usd.format(props.unsettledUsd)}</small>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`account-section loan-summary-inline ${props.loanStatus === 'overdue' ? 'is-danger' : ''}`} aria-label="대출">
        <SectionHeader title="대출" />
        <div className="account-row"><div><strong>WS은행 대출</strong><span>{props.loanSubtitle}</span></div><b className="financial-amount">₩{krw.format(props.loanPrincipal)}</b></div>
      </section>
    </>
  )
}
