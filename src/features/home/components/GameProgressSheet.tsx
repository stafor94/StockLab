import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { TimeControl, type TimeControlProps } from './TimeControl'

export function GameProgressSheet(props: TimeControlProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const close = () => {
    setOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
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
