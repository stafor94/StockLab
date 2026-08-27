import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoplayToastViewport } from './AutoplayToastViewport'
import { useAutoplayUiStore, type AutoplayNotice } from './autoplayUiStore'

const notices: AutoplayNotice[] = Array.from({ length: 4 }, (_, index) => ({
  id: `notice-${index + 1}`,
  kind: index % 2 === 0 ? 'news' : 'event',
  date: `2018-01-0${index + 2}`,
  title: `알림 ${index + 1}`,
  message: `자동진행 알림 ${index + 1}`,
}))

beforeEach(() => {
  vi.useFakeTimers()
  useAutoplayUiStore.getState().reset()
})

afterEach(() => {
  useAutoplayUiStore.getState().reset()
  vi.useRealTimers()
})

describe('AutoplayToastViewport', () => {
  it('shows at most three notices at once and rotates queued notices after three seconds', async () => {
    useAutoplayUiStore.getState().enqueueNotices(notices)
    render(<AutoplayToastViewport />)

    expect(screen.getAllByRole('status')).toHaveLength(3)
    expect(screen.getByText('알림 1')).not.toBeNull()
    expect(screen.queryByText('알림 4')).toBeNull()

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByText('알림 4')).not.toBeNull()

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })
})
