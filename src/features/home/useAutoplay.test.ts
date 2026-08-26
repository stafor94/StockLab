import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoplay } from './useAutoplay'

afterEach(() => vi.useRealTimers())

describe('useAutoplay', () => {
  it('ticks at the selected speed and stops when the callback returns false', async () => {
    vi.useFakeTimers()
    const tick = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false)
    const { result } = renderHook(() => useAutoplay(tick, false))
    act(() => { result.current.setSpeed(10); result.current.start() })
    await act(async () => { await vi.advanceTimersByTimeAsync(210) })
    expect(tick).toHaveBeenCalledTimes(2)
    expect(result.current.running).toBe(false)
  })

  it('waits for an async tick before scheduling the next one', async () => {
    vi.useFakeTimers()
    let resolveFirst: ((value: boolean) => void) | null = null
    const tick = vi.fn(() => new Promise<boolean>((resolve) => {
      if (!resolveFirst) resolveFirst = resolve
      else resolve(false)
    }))
    const { result } = renderHook(() => useAutoplay(tick, false))
    act(() => { result.current.setSpeed(10); result.current.start() })

    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(tick).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(tick).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst?.(true)
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('cannot run while blocked', () => {
    const { result } = renderHook(() => useAutoplay(() => true, true))
    act(() => result.current.start())
    expect(result.current.running).toBe(false)
  })
})
