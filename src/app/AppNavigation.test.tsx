import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppNavigation } from './AppNavigation'

describe('AppNavigation', () => {
  it('색상 표시와 별개로 배지 내용을 접근 가능한 이름에 포함한다', () => {
    render(<AppNavigation active="홈" onChange={vi.fn()} badges={{ 뉴스: '확인하지 않은 중요 알림 있음' }} />)
    expect(screen.getByRole('button', { name: '뉴스, 확인하지 않은 중요 알림 있음' })).toBeTruthy()
  })
})
