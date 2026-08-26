import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpProvider } from '../features/help/HelpCenter'
import { AppNavigation } from './AppNavigation'

describe('AppNavigation', () => {
  it('includes attention reasons in the accessible navigation label', () => {
    render(<HelpProvider><AppNavigation active="홈" onChange={vi.fn()} guidance={{ 뉴스: { attentionCount: 1, attentionReason: '확인하지 않은 중요 뉴스 1건' } }} /></HelpProvider>)
    expect(screen.getByRole('button', { name: '뉴스, 확인하지 않은 중요 뉴스 1건' })).toBeTruthy()
  })
})
