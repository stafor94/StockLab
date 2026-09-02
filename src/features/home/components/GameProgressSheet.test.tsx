import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpProvider } from '../../help/HelpCenter'
import { GameProgressSheet } from './GameProgressSheet'

afterEach(cleanup)

const baseProps = {
  message: '다음 날짜로 진행할 수 있습니다.',
  primaryLabel: '다음 날',
  primaryDisabled: false,
  onPrimary: vi.fn(),
  timelineReady: true,
  sessionAdvanceBlocked: false,
  processingSession: false,
  running: false,
  speed: 1 as const,
  onSpeedChange: vi.fn(),
  onToggleAutoplay: vi.fn(),
}

function renderSheet(props = baseProps) {
  return render(<HelpProvider><GameProgressSheet {...props} /></HelpProvider>)
}

describe('GameProgressSheet', () => {
  it('keeps progress controls unmounted until the compact trigger is opened', () => {
    renderSheet()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '게임 진행 열기' }))
    expect(screen.getByRole('dialog', { name: '시간 진행' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '다음 날' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+1주' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+1개월' })).toBeNull()
  })

  it('closes with Escape without changing game progression', () => {
    const onPrimary = vi.fn()
    renderSheet({ ...baseProps, onPrimary })
    fireEvent.click(screen.getByRole('button', { name: '게임 진행 열기' }))

    fireEvent.keyDown(screen.getByRole('dialog', { name: '시간 진행' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onPrimary).not.toHaveBeenCalled()
  })
})
