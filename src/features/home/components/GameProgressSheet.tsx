import { useRef, useState, type KeyboardEvent } from 'react'
import { useModalFocus } from '../../../components/useModalFocus'
import { TimeControl, type TimeControlProps } from './TimeControl'

export function GameProgressSheet(props: TimeControlProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const trapFocus = useModalFocus(open, closeButtonRef)

  const close = () => {
    setOpen(false)
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    trapFocus(event)
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`game-progress-trigger ${props.running ? 'running' : ''}`}
        type="button"
        aria-label="게임 진행 열기"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tutorial-id="game-progress-trigger"
        onClick={() => setOpen(true)}
      >
        <span className="game-progress-trigger-mark" aria-hidden="true" />
        <span className="game-progress-trigger-copy">
          <small>게임 진행</small>
          <strong>{props.running ? `자동진행 ${props.speed}×` : props.primaryLabel}</strong>
        </span>
      </button>

      {open && (
        <div
          className="game-progress-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section
            className="game-progress-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="time-control-title"
            onKeyDown={handleDialogKeyDown}
          >
            <div className="game-progress-sheet-handle" aria-hidden="true" />
            <button ref={closeButtonRef} className="game-progress-close" type="button" aria-label="게임 진행 닫기" onClick={close}>×</button>
            <TimeControl {...props} />
          </section>
        </div>
      )}
    </>
  )
}
