import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useModalFocus } from '../../components/useModalFocus'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  onResetGame: () => void
}

export function SettingsDialog({ open, onClose, onResetGame }: SettingsDialogProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const trapFocus = useModalFocus(open, closeButtonRef)

  useEffect(() => {
    if (!open) setConfirmingReset(false)
  }, [open])

  if (!open) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    trapFocus(event)
  }

  const confirmReset = () => {
    onResetGame()
    setConfirmingReset(false)
  }

  return (
    <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={handleKeyDown}
      >
        <header className="settings-dialog-header">
          <div>
            <p className="section-kicker">SETTINGS</p>
            <h2 id="settings-title">설정</h2>
          </div>
          <button ref={closeButtonRef} className="settings-close" type="button" aria-label="설정 닫기" onClick={onClose}>×</button>
        </header>

        <section className="settings-section" aria-labelledby="settings-game-title">
          <div className="settings-section-copy">
            <h3 id="settings-game-title">게임 관리</h3>
            <p>현재 진행 중인 게임을 지우고 2018-01-01, 초기 자산 상태에서 다시 시작할 수 있습니다.</p>
          </div>

          {!confirmingReset ? (
            <button className="settings-reset-button" type="button" onClick={() => setConfirmingReset(true)}>
              처음부터 다시 시작
            </button>
          ) : (
            <div className="settings-reset-confirm" role="alert">
              <strong>게임을 정말 초기화할까요?</strong>
              <p>게임 날짜, 현금, 보유 종목, 주문·거래 내역, 환전, 대출 및 진행 상태가 초기값으로 돌아갑니다. 이 작업은 되돌릴 수 없습니다.</p>
              <div>
                <button className="secondary-button" type="button" onClick={() => setConfirmingReset(false)}>취소</button>
                <button className="settings-reset-confirm-button" type="button" onClick={confirmReset}>게임 초기화</button>
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  )
}
