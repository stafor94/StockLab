import { useState } from 'react'
import { SectionHeader } from '../../components/ui'
import { useGameStore } from '../../stores/gameStore'
import { ExchangeScreen } from './ExchangeScreen'
import { LoanScreen } from './LoanScreen'

type AssetTab = 'exchange' | 'loan'
const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function AssetScreen() {
  const [tab, setTab] = useState<AssetTab>('exchange')
  const game = useGameStore()
  const pendingKrw = game.pendingSettlements.filter((item) => item.currency === 'KRW').reduce((sum, item) => sum + item.amount, 0)
  const pendingUsd = game.pendingSettlements.filter((item) => item.currency === 'USD').reduce((sum, item) => sum + item.amount, 0)

  return (
    <main className="asset-tools-screen">
      <section className="asset-account-overview">
        <SectionHeader title="자산" description="현금, 결제 예정 금액과 대출을 관리합니다." />
        <div className="asset-account-groups">
          <div className="asset-account-group"><h3>현금</h3><div className="detail-row-list"><div><span>원화</span><strong className="financial-amount">₩{krw.format(game.krwCash)}</strong></div><div><span>달러</span><strong className="financial-amount">${usd.format(game.usdCash)}</strong></div></div></div>
          <div className="asset-account-group"><h3>결제 예정</h3><div className="detail-row-list"><div><span>원화</span><strong className="financial-amount">₩{krw.format(pendingKrw)}</strong></div><div><span>달러</span><strong className="financial-amount">${usd.format(pendingUsd)}</strong></div></div></div>
          <div className="asset-account-group"><h3>대출</h3><div className="detail-row-list"><div><span>WS은행</span><strong className="financial-amount">₩{krw.format(game.loan.principal)}</strong></div></div></div>
        </div>
      </section>
      <nav className="segmented-control asset-tool-tabs" aria-label="자산 관리 메뉴">
        <button type="button" aria-pressed={tab === 'exchange'} className={tab === 'exchange' ? 'active' : ''} onClick={() => setTab('exchange')}>환전</button>
        <button type="button" aria-pressed={tab === 'loan'} className={tab === 'loan' ? 'active' : ''} onClick={() => setTab('loan')}>WS은행 대출</button>
      </nav>
      {tab === 'exchange' ? <ExchangeScreen /> : <LoanScreen />}
    </main>
  )
}
