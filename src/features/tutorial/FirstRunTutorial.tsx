import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useModalFocus } from '../../components/useModalFocus'
import { tutorialSteps } from './tutorialSteps'

interface FirstRunTutorialProps {
  open: boolean
  onComplete: () => void
  onSkip: () => void
}

export function FirstRunTutorial({ open, onComplete, onSkip }: FirstRunTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const trapFocus = useModalFocus(open, primaryRef)
  const step = tutorialSteps[stepIndex]

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => primaryRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open, stepIndex])

  useEffect(() => {
    if (!open || !step.targetId) return
    const target = document.querySelector<HTMLElement>(`[data-tutorial-id="${step.targetId}"]`)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    target.dataset.tutorialHighlight = 'true'
    return () => { delete target.dataset.tutorialHighlight }
  }, [open, step.targetId])

  if (!open) return null

  const closeOrTrap = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onSkip()
      return
    }
    trapFocus(event)
  }
  const isIntro = stepIndex === 0
  const isLast = stepIndex === tutorialSteps.length - 1

  return (
    <div className="tutorial-backdrop">
      <section className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" onKeyDown={closeOrTrap}>
        <div className="tutorial-progress" aria-label={`튜토리얼 ${stepIndex + 1}/${tutorialSteps.length}`}>
          {tutorialSteps.map((item, index) => <span key={item.id} className={index <= stepIndex ? 'active' : ''} />)}
        </div>
        <p className="section-kicker">{step.eyebrow}</p>
        <h2 id="tutorial-title">{step.title}</h2>
        <p id="tutorial-description">{step.description}</p>
        <div className="tutorial-actions">
          {isIntro ? (
            <>
              <button ref={primaryRef} className="primary-button" type="button" onClick={() => setStepIndex(1)}>3분 둘러보기</button>
              <button className="secondary-button" type="button" onClick={onSkip}>건너뛰기</button>
            </>
          ) : (
            <>
              <button className="secondary-button" type="button" onClick={() => setStepIndex((current) => current - 1)}>이전</button>
              <button ref={primaryRef} className="primary-button" type="button" onClick={() => isLast ? onComplete() : setStepIndex((current) => current + 1)}>{isLast ? '시작하기' : '다음'}</button>
            </>
          )}
        </div>
        {!isIntro && <button className="tutorial-skip" type="button" onClick={onSkip}>튜토리얼 건너뛰기</button>}
      </section>
    </div>
  )
}
