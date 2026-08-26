import { useEffect, useRef, useState } from 'react'
import type { NavigationItem } from '../../app/AppNavigation'
import { useGameStore } from '../../stores/gameStore'
import { selectNextAction } from './guidanceSelectors'
import { recordLocalQaEvent } from './localQaEvents'

export function Guidance({ onNavigate }: { onNavigate: (item: NavigationItem) => void }) {
  const game = useGameStore()
  const [helpOpen, setHelpOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(game.guidance.tutorialStatus === 'not-started')
  const [actions, setActions] = useState(0)
  const previousPhase = useRef(game.marketSessionPhase)
  const next = selectNextAction({ phase: game.marketSessionPhase, pendingImportantAlert: game.pendingImportantEvents.length + game.pendingImportantNews.length > 0, autoplayRunning: false, error: null, pendingOrderCount: game.pendingOrders.length })
  const navigate = () => { setActions((value) => value + 1); recordLocalQaEvent({ name: 'guidance_action', step: next.step, actionCount: actions + 1 }); onNavigate(next.step === 'place-order' || next.step === 'open-market' ? '시장' : '홈') }
  const finish = (skipped: boolean) => { game.setTutorialStatus(skipped ? 'skipped' : 'completed'); recordLocalQaEvent({ name: skipped ? 'tutorial_skipped' : 'tutorial_completed' }); setTutorialOpen(false) }

  useEffect(() => {
    if (previousPhase.current === 'preopen' && game.marketSessionPhase === 'opened') recordLocalQaEvent({ name: 'first_market_open', actionCount: actions })
    if (previousPhase.current === 'opened' && game.marketSessionPhase === 'closed') recordLocalQaEvent({ name: 'first_day_closed' })
    previousPhase.current = game.marketSessionPhase
  }, [actions, game.marketSessionPhase])

  return <>
    <aside className="guidance-card" aria-label="다음 행동 안내">
      <div><span>다음 행동</span><strong>{next.title}</strong><small>{next.description}</small></div>
      <div className="guidance-actions"><button type="button" onClick={navigate}>{next.actionLabel}</button><button type="button" onClick={() => setHelpOpen(true)}>도움말</button></div>
    </aside>
    {game.guidance.tutorialStatus === 'active' && <aside className="tutorial-checklist" aria-label="첫 거래일 체크리스트"><strong>첫 거래일 연습 중</strong><span>시장 → 주문(선택) → 장 시작 → 장 마감 → 다음 날</span><button type="button" onClick={() => finish(false)}>튜토리얼 완료</button></aside>}
    {tutorialOpen && <div className="guidance-backdrop"><section className="guidance-dialog" role="dialog" aria-modal="true" aria-label="StockLab 튜토리얼"><p className="section-kicker">처음 오셨나요?</p><h2>첫 거래일을 함께 시작해요</h2><ol><li>시장에서 종목을 살펴봅니다.</li><li>원하면 개장 전 주문을 접수합니다.</li><li>장을 시작하고 마감한 뒤 다음 날로 이동합니다.</li></ol><p>주문하지 않아도 게임 진행은 막히지 않습니다.</p><div className="guidance-actions"><button type="button" className="primary-button" onClick={() => { game.setTutorialStatus('active'); onNavigate('시장'); setTutorialOpen(false) }}>튜토리얼 시작</button><button type="button" onClick={() => finish(true)}>건너뛰기</button></div></section></div>}
    {helpOpen && <div className="guidance-backdrop"><section className="guidance-dialog" role="dialog" aria-modal="true" aria-label="도움말"><h2>게임 진행 도움말</h2><p>개장 전에는 미래 가격이 숨겨집니다. 주문은 실제 시가에 한 번 체결되며, 주문 없이 장을 시작해도 됩니다.</p><h3>첫 거래일 체크리스트</h3><ul><li>시장 둘러보기</li><li>장 시작</li><li>장 마감</li><li>다음 게임일 이동</li></ul><button type="button" onClick={() => setHelpOpen(false)}>도움말 닫기</button></section></div>}
  </>
}
