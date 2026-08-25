import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoplay } from './useAutoplay'

afterEach(() => vi.useRealTimers())

describe('useAutoplay', () => {
  it('ticks at the selected speed and stops when the callback returns false', () => {
    vi.useFakeTimers()
    const tick = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false)
    const { result } = renderHook(() => useAutoplay(tick, false))
    act(() => { result.current.setSpeed(10); result.current.start() })
    act(() => { vi.advanceTimersByTime(210) })
    expect(tick).toHaveBeenCalledTimes(2)
    expect(result.current.running).toBe(false)
  })

  it('cannot run while blocked', () => {
    const { result } = renderHook(() => useAutoplay(() => true, true))
    act(() => result.current.start())
    expect(result.current.running).toBe(false)
  })
})
