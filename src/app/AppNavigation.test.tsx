import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpProvider } from '../features/help/HelpCenter'
import { AppNavigation } from './AppNavigation'

describe('AppNavigation', () => {
  it('includes attention reasons in the accessible navigation label', () => {
    render(<HelpProvider><AppNavigation active="홈" onChange={vi.fn()} guidance={{ 뉴스: { attentionCount: 1, attentionReason: '확인하지 않은 중요 뉴스 1건' } }} /></HelpProvider>)
    expect(screen.getByRole('button', { name: '뉴스, 확인하지 않은 중요 뉴스 1건' })).toBeTruthy()
  })

  it('clears stale navigation focus after pointer input without disabling normal focus', () => {
    render(<HelpProvider><AppNavigation active="홈" onChange={vi.fn()} /></HelpProvider>)
    const home = screen.getByRole('button', { name: '홈' })
    const market = screen.getByRole('button', { name: '시장' })

    home.focus()
    expect(document.activeElement).toBe(home)

    fireEvent.pointerDown(market)
    expect(document.activeElement).not.toBe(home)

    market.focus()
    fireEvent.pointerUp(market)
    expect(document.activeElement).not.toBe(market)

    market.focus()
    expect(document.activeElement).toBe(market)
  })
})
