import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProgressSheet } from './GameProgressSheet'

afterEach(cleanup)

const baseProps = {
  guidance: { severity: 'info' as const, title: '다음 날짜', description: '다음 날짜로 진행할 수 있습니다.', actionLabel: '다음 날', actionTarget: 'ADVANCE_DATE' as const },
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
  onAdvanceWeek: vi.fn(),
  onAdvanceMonth: vi.fn(),
}

describe('GameProgressSheet', () => {
  it('keeps progress controls unmounted until the compact trigger is opened', () => {
    render(<GameProgressSheet {...baseProps} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '게임 진행 열기' }))
    expect(screen.getByRole('dialog', { name: '시간 진행' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '다음 날' })).toBeTruthy()
  })

  it('closes with Escape without changing game progression', () => {
    const onPrimary = vi.fn()
    render(<GameProgressSheet {...baseProps} onPrimary={onPrimary} />)
    fireEvent.click(screen.getByRole('button', { name: '게임 진행 열기' }))

    fireEvent.keyDown(screen.getByRole('dialog', { name: '시간 진행' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onPrimary).not.toHaveBeenCalled()
  })

  it('announces a critical interruption as an alert with its recovery action', () => {
    render(<GameProgressSheet {...baseProps} guidance={{ severity: 'critical', title: '데이터 로드 실패', description: '필수 데이터를 확인할 수 없습니다.', actionLabel: '다시 시도', actionTarget: 'RETRY_DATA' }} primaryDisabled />)
    fireEvent.click(screen.getByRole('button', { name: '게임 진행 열기' }))

    expect(screen.getByRole('alert').textContent).toContain('데이터 로드 실패')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '다시 시도' }).disabled).toBe(true)
    expect(screen.getByText(/사용할 수 없습니다/)).toBeTruthy()
  })
})
