import { useRef, type KeyboardEvent } from 'react'
import { useModalFocus } from '../../components/useModalFocus'
import '../../styles/trading-dialog.css'

interface OrderErrorDialogProps {
  message: string | null
  onClose: () => void
}

export function OrderErrorDialog({ message, onClose }: OrderErrorDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const open = Boolean(message)
  const trapFocus = useModalFocus(open, confirmButtonRef)

  if (!message) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    trapFocus(event)
  }

  return (
    <div className="order-error-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        className="order-error-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="order-error-title"
        aria-describedby="order-error-message"
        onKeyDown={handleKeyDown}
      >
        <div className="order-error-icon" aria-hidden="true">!</div>
        <div className="order-error-copy">
          <p className="section-kicker">ORDER ERROR</p>
          <h2 id="order-error-title">주문을 처리할 수 없습니다</h2>
          <p id="order-error-message">{message}</p>
        </div>
        <button ref={confirmButtonRef} className="order-error-confirm" type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  )
}
