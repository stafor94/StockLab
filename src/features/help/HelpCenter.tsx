import { createContext, useContext, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useModalFocus } from '../../components/useModalFocus'

export type HelpSectionId = 'goal' | 'day' | 'orders' | 'prices' | 'exchange' | 'settlement' | 'loan' | 'autoplay'

interface HelpContextValue {
  openHelp: (section?: HelpSectionId) => void
}

const HelpContext = createContext<HelpContextValue | null>(null)

const sections: Array<{ id: HelpSectionId; title: string; content: ReactNode }> = [
  { id: 'goal', title: '게임의 목표', content: <p>과거의 시장을 시간순으로 경험하며 투자 판단을 내리고 순자산을 키워 보세요. 미래의 가격이나 사건은 현재 게임 시점보다 먼저 알 수 없습니다.</p> },
  { id: 'day', title: '시장이 진행되는 방식', content: <p>게임에는 하나의 시간축이 있고 국내장과 미국장은 각자의 거래일·거래시간에 따라 독립적으로 움직입니다. <strong>국내장 시작 → 국내장 마감 → 미국장 시작 → 미국장 마감</strong>처럼 실제 다음 시장 이벤트로 진행하며, 휴장인 시장의 이벤트는 자동으로 건너뜁니다.</p> },
  { id: 'orders', title: '시장 주문', content: <p><strong>현재 열린 시장의 종목만</strong> 해당 거래일의 실제 시가로 매수·매도할 수 있습니다. 다른 시장과 이미 마감한 시장의 종목은 주문할 수 없습니다. 주문 입력 중 수량·주식 금액·수수료·총 필요금액 또는 예상 정산액을 미리 확인할 수 있습니다.</p> },
  { id: 'prices', title: '가격·차트 공개 범위', content: <p>각 시장의 개장 전에는 그 거래일 OHLC를 숨기고, 장중에는 실제 시가만 공개합니다. 장 마감 후에는 해당 거래일의 전체 OHLC와 종가를 공개해 평가에 반영하지만 추가 주문은 받지 않습니다.</p> },
  { id: 'exchange', title: '환전과 미국 주식', content: <p>미국 주식과 ETF는 USD로 주문합니다. 자산 화면에서 현재 게임 날짜에 공개된 USD/KRW 환율로 환전할 수 있으며, 국내장이나 미국장 중 하나라도 열려 있으면 환전할 수 없습니다.</p> },
  { id: 'settlement', title: '결제 대기금', content: <p>매도 후 결제일 전 금액은 아직 사용할 수 없는 미결제 대금입니다. 결제일에 비용을 반영한 순액이 현금으로 전환됩니다.</p> },
  { id: 'loan', title: 'WS은행 대출', content: <p>대출이자는 정해진 납부일에 결제 완료 원화 현금에서 자동 출금됩니다. 3개월 연속 미납하면 게임오버입니다.</p> },
  { id: 'autoplay', title: '자동진행 중단', content: <p>자동진행은 다음 국내장/미국장 OPEN·CLOSE 이벤트를 시간순으로 진행하지만 임의로 매매하지 않습니다. 중요 뉴스, 기업 이벤트, 대출 자동출금 실패, 게임오버, 필수 데이터 오류에서는 자동진행이 멈춥니다.</p> },
]

const replaySteps = [
  ['1. 다음 시장 이벤트', '게임 진행 버튼은 현재 시각 다음에 실제로 발생하는 국내장 또는 미국장 이벤트를 표시합니다. 휴장일과 주말은 자동으로 건너뜁니다.'],
  ['2. 장 시작', '국내장이나 미국장이 시작되면 그 시장의 당일 실제 시가가 공개됩니다. 열린 시장 종목만 이 시가로 매수·매도할 수 있습니다.'],
  ['3. 시가 주문', '시장 탭에서 열린 시장의 종목을 선택하고 수량이나 금액을 입력하세요. 수수료를 포함한 총 필요금액을 확인한 뒤 공개된 시가로 즉시 체결할 수 있습니다.'],
  ['4. 장 마감', '장이 마감되면 해당 거래일의 고가·저가·종가를 포함한 전체 OHLC가 공개되고 평가에 반영됩니다. 마감한 시장의 주문은 종료되며 다음 실제 시장 이벤트로 진행합니다.'],
] as const

export function HelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<HelpSectionId>('goal')
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const trapFocus = useModalFocus(open, closeButtonRef)

  const openHelp = (target: HelpSectionId = 'goal') => {
    setSection(target)
    setTutorialStep(null)
    setOpen(true)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    trapFocus(event)
  }

  return <HelpContext.Provider value={{ openHelp }}>
    {children}
    {open && <div className="help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-title" onKeyDown={handleKeyDown}>
        <header className="help-sheet-header">
          <div><p className="section-kicker">PLAY GUIDE</p><h2 id="help-title">{tutorialStep === null ? '도움말' : '튜토리얼 다시 보기'}</h2></div>
          <button ref={closeButtonRef} className="help-close" type="button" aria-label="도움말 닫기" onClick={() => setOpen(false)}>×</button>
        </header>
        {tutorialStep === null ? <>
          <nav className="help-index" aria-label="도움말 목차">{sections.map((item) => <button className={item.id === section ? 'active' : ''} type="button" key={item.id} onClick={() => { setSection(item.id); document.getElementById(`help-${item.id}`)?.scrollIntoView({ block: 'start' }) }}>{item.title}</button>)}</nav>
          <div className="help-content">{sections.map((item) => <article id={`help-${item.id}`} key={item.id}><h3>{item.title}</h3>{item.content}</article>)}</div>
          <button className="primary-button help-tutorial-button" type="button" onClick={() => setTutorialStep(0)}>튜토리얼 다시 보기</button>
        </> : <div className="help-tutorial">
          <p className="help-tutorial-progress">{tutorialStep + 1} / {replaySteps.length}</p>
          <h3>{replaySteps[tutorialStep][0]}</h3><p>{replaySteps[tutorialStep][1]}</p>
          <p className="help-safe-note">튜토리얼을 다시 봐도 게임 날짜, 주문, 현금, 보유 종목은 초기화되지 않습니다.</p>
          <div><button className="secondary-button" type="button" onClick={() => tutorialStep === 0 ? setTutorialStep(null) : setTutorialStep(tutorialStep - 1)}>이전</button><button className="primary-button" type="button" onClick={() => tutorialStep === replaySteps.length - 1 ? setTutorialStep(null) : setTutorialStep(tutorialStep + 1)}>{tutorialStep === replaySteps.length - 1 ? '도움말로 돌아가기' : '다음'}</button></div>
        </div>}
      </section>
    </div>}
  </HelpContext.Provider>
}

export function useHelp() {
  const context = useContext(HelpContext)
  if (!context) throw new Error('useHelp must be used within HelpProvider')
  return context
}

export function HelpLink({ section, children = '자세히' }: { section: HelpSectionId; children?: ReactNode }) {
  const { openHelp } = useHelp()
  return <button className="context-help-link" type="button" onClick={() => openHelp(section)}>{children}</button>
}
