import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog', () => {
  it('requires a second explicit action before resetting the game', async () => {
    const onClose = vi.fn()
    const onResetGame = vi.fn()
    render(<SettingsDialog open onClose={onClose} onResetGame={onResetGame} />)

    const dialog = screen.getByRole('dialog', { name: '설정' })
    expect(dialog).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '설정 닫기' })))

    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 시작' }))
    expect(onResetGame).not.toHaveBeenCalled()
    expect(screen.getByText('게임을 정말 초기화할까요?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '게임 초기화' }))
    expect(onResetGame).toHaveBeenCalledTimes(1)
  })

  it('can cancel the destructive confirmation without resetting', () => {
    const onResetGame = vi.fn()
    render(<SettingsDialog open onClose={vi.fn()} onResetGame={onResetGame} />)

    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 시작' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onResetGame).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '처음부터 다시 시작' })).toBeTruthy()
  })
})
