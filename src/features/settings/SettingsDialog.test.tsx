import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY } from './theme'
import { SettingsDialog } from './SettingsDialog'

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('SettingsDialog', () => {
  it('switches the screen mode and persists the selection', () => {
    const { container } = render(<SettingsDialog open onClose={vi.fn()} onResetGame={vi.fn()} />)
    const view = within(container)
    const lightButton = view.getByRole('button', { name: '화이트 모드' })
    const darkButton = view.getByRole('button', { name: '다크 모드' })

    expect(lightButton.getAttribute('aria-pressed')).toBe('true')
    expect(darkButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(darkButton)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(darkButton.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(lightButton)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(lightButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('requires a second explicit action before resetting the game', async () => {
    const onClose = vi.fn()
    const onResetGame = vi.fn()
    const { container } = render(<SettingsDialog open onClose={onClose} onResetGame={onResetGame} />)
    const view = within(container)

    const dialog = view.getByRole('dialog', { name: '설정' })
    expect(dialog).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('button', { name: '설정 닫기' })))

    fireEvent.click(view.getByRole('button', { name: '처음부터 다시 시작' }))
    expect(onResetGame).not.toHaveBeenCalled()
    expect(view.getByText('게임을 정말 초기화할까요?')).toBeTruthy()

    fireEvent.click(view.getByRole('button', { name: '게임 초기화' }))
    expect(onResetGame).toHaveBeenCalledTimes(1)
  })

  it('can cancel the destructive confirmation without resetting', () => {
    const onResetGame = vi.fn()
    const { container } = render(<SettingsDialog open onClose={vi.fn()} onResetGame={onResetGame} />)
    const view = within(container)

    fireEvent.click(view.getByRole('button', { name: '처음부터 다시 시작' }))
    fireEvent.click(view.getByRole('button', { name: '취소' }))

    expect(onResetGame).not.toHaveBeenCalled()
    expect(view.getByRole('button', { name: '처음부터 다시 시작' })).toBeTruthy()
  })
})
