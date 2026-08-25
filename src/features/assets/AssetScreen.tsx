import { useState } from 'react'
import { ExchangeScreen } from './ExchangeScreen'
import { LoanScreen } from './LoanScreen'

type AssetTab = 'exchange' | 'loan'

export function AssetScreen() {
  const [tab, setTab] = useState<AssetTab>('exchange')
  return (
    <main className="asset-tools-screen">
      <nav className="asset-tool-tabs" aria-label="자산 관리 메뉴">
        <button type="button" className={tab === 'exchange' ? 'active' : ''} onClick={() => setTab('exchange')}>환전</button>
        <button type="button" className={tab === 'loan' ? 'active' : ''} onClick={() => setTab('loan')}>WS은행 대출</button>
      </nav>
      {tab === 'exchange' ? <ExchangeScreen /> : <LoanScreen />}
    </main>
  )
}
