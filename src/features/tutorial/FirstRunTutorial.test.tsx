import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FirstRunTutorial } from './FirstRunTutorial'

describe('FirstRunTutorial', () => {
  it('offers the tour and skip actions without blocking on completion', () => {
    const onSkip = vi.fn()
    render(<FirstRunTutorial open onComplete={vi.fn()} onSkip={onSkip} />)

    expect(screen.getByRole('dialog', { name: '미래를 모른 채 투자해 보세요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '3분 둘러보기' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('supports Escape and completes after five steps', () => {
    const onSkip = vi.fn()
    const onComplete = vi.fn()
    const { rerender } = render(<FirstRunTutorial open onComplete={onComplete} onSkip={onSkip} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onSkip).toHaveBeenCalledOnce()

    rerender(<FirstRunTutorial open onComplete={onComplete} onSkip={onSkip} />)
    fireEvent.click(screen.getByRole('button', { name: '3분 둘러보기' }))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
