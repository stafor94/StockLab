import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type HelpSectionId = 'goal' | 'day' | 'orders' | 'prices' | 'exchange' | 'settlement' | 'loan' | 'autoplay'

interface HelpContextValue {
  openHelp: (section?: HelpSectionId) => void
}

const HelpContext = createContext<HelpContextValue | null>(null)

const sections: Array<{ id: HelpSectionId; title: string; content: ReactNode }> = [
  { id: 'goal', title: '게임의 목표', content: <p>과거의 시장을 하루씩 경험하며 투자 판단을 내리고 순자산을 키워 보세요. 미래의 가격이나 사건은 현재 게임 시점보다 먼저 알 수 없습니다.</p> },
  { id: 'day', title: '하루가 진행되는 방식', content: <p>거래일은 <Term name="개장 전">장이 열리기 전 주문을 준비하는 단계</Term> → <Term name="장중">장이 열린 뒤 당일 시가만 확인할 수 있는 단계</Term> → <Term name="장 마감">거래가 끝나 당일 전체 가격이 확정된 단계</Term> 순서입니다. <strong>거래일은 반드시 장을 마감한 뒤에만 다음 날짜로 이동할 수 있습니다.</strong></p> },
  { id: 'orders', title: '주문과 시가 체결', content: <p>개장 전에는 당일 가격을 미리 볼 수 없습니다. 이때 접수한 주문은 장 시작 시 <strong>당일 실제 시가</strong>와 수수료·비용을 기준으로 한 번 체결됩니다. 시가 상승으로 현금이 부족한 수량 주문 등은 취소될 수 있습니다.</p> },
  { id: 'prices', title: '가격·차트 정보 공개 범위', content: <p>개장 전에는 당일 OHLC를 모두 숨기고 이전 거래일 종가로 평가합니다. 장중에는 <strong>시가만</strong> 공개하고 고가·저가·종가는 숨깁니다. 장 마감 후에만 당일 <strong>전체 OHLC(시가·고가·저가·종가)</strong>와 완성된 차트를 공개합니다.</p> },
  { id: 'exchange', title: '환전과 미국 주식', content: <p>미국 주식과 ETF는 USD로 주문합니다. 자산 화면에서 게임 날짜에 확인 가능한 USD/KRW 환율로 원화와 달러를 환전한 뒤, 결제가 끝난 달러 현금 범위에서 주문하세요.</p> },
  { id: 'settlement', title: '결제 대기금', content: <p><Term name="미결제 대금">매도는 끝났지만 시장별 결제일이 아직 오지 않아 현금으로 사용할 수 없는 금액</Term>입니다. 결제일에 세금·규제비용·수수료를 뺀 순액이 현금이 되며, 그전에는 주문·환전·대출이자 납부에 쓸 수 없습니다.</p> },
  { id: 'loan', title: 'WS은행 대출과 게임오버 조건', content: <p>대출이자는 정해진 납부일에 결제 완료 원화 현금에서 자동 출금됩니다. 이자를 내지 못하면 연체되며, <strong>3개월 연속 미납하면 게임오버</strong>입니다. 미결제 매도대금은 이자 납부 현금으로 인정되지 않습니다.</p> },
  { id: 'autoplay', title: '자동진행이 멈추는 이유', content: <p>중요 뉴스, 중요한 기업 이벤트, WS은행 자동출금 실패 또는 게임오버가 발생하면 확인할 수 있도록 자동진행이 멈춥니다. 필수 데이터가 준비되지 않았거나 제공된 날짜 범위의 끝에 도달해도 더 진행하지 않습니다.</p> },
]

const tutorialSteps = [
  ['1. 개장 전', '당일 가격은 보이지 않습니다. 공개된 과거 정보만 보고 주문을 준비하세요.'],
  ['2. 장 시작', '개장 전 주문이 당일 실제 시가에 체결되고, 장중에는 시가만 공개됩니다.'],
  ['3. 장 마감', '장을 마감하면 고가·저가·종가를 포함한 전체 OHLC가 공개됩니다.'],
  ['4. 다음 날짜', '거래일을 마감한 뒤에만 다음 날짜로 이동할 수 있습니다. 중요 이벤트에서는 자동진행이 멈춥니다.'],
] as const

function Term({ name, children }: { name: string; children: ReactNode }) {
  return <span className="help-term"><strong>{name}</strong><span className="help-term-description"> — {children}</span></span>
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<HelpSectionId>('goal')
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const openHelp = (target: HelpSectionId = 'goal') => {
    setSection(target)
    setTutorialStep(null)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (open && tutorialStep === null) document.getElementById(`help-${section}`)?.scrollIntoView({ block: 'start' })
  }, [open, section, tutorialStep])

  return <HelpContext.Provider value={{ openHelp }}>
    {children}
    {open && <div className="help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header className="help-sheet-header"><div><p className="section-kicker">PLAY GUIDE</p><h2 id="help-title">{tutorialStep === null ? '도움말' : '튜토리얼 다시 보기'}</h2></div><button ref={closeButtonRef} className="help-close" type="button" aria-label="도움말 닫기" onClick={() => setOpen(false)}>×</button></header>
        {tutorialStep === null ? <>
          <nav className="help-index" aria-label="도움말 목차">{sections.map((item) => <button className={item.id === section ? 'active' : ''} type="button" key={item.id} onClick={() => { setSection(item.id); document.getElementById(`help-${item.id}`)?.scrollIntoView({ block: 'start' }) }}>{item.title}</button>)}</nav>
          <div className="help-content">{sections.map((item) => <article id={`help-${item.id}`} key={item.id}><h3>{item.title}</h3>{item.content}</article>)}</div>
          <button className="primary-button help-tutorial-button" type="button" onClick={() => setTutorialStep(0)}>튜토리얼 다시 보기</button>
        </> : <div className="help-tutorial">
          <p className="help-tutorial-progress">{tutorialStep + 1} / {tutorialSteps.length}</p>
          <h3>{tutorialSteps[tutorialStep][0]}</h3><p>{tutorialSteps[tutorialStep][1]}</p>
          <p className="help-safe-note">튜토리얼을 다시 봐도 게임 날짜, 주문, 현금, 보유 종목은 초기화되지 않습니다.</p>
          <div><button className="secondary-button" type="button" onClick={() => tutorialStep === 0 ? setTutorialStep(null) : setTutorialStep(tutorialStep - 1)}>이전</button><button className="primary-button" type="button" onClick={() => tutorialStep === tutorialSteps.length - 1 ? setTutorialStep(null) : setTutorialStep(tutorialStep + 1)}>{tutorialStep === tutorialSteps.length - 1 ? '도움말로 돌아가기' : '다음'}</button></div>
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
