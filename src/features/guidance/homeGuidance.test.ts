import { describe, expect, it } from 'vitest'
import { createHomeGuidance, type HomeGuidanceInput } from './homeGuidance'

Object.defineProperty(globalThis, 'localStorage', {
  value: { clear() {} },
  configurable: true,
})

const base: HomeGuidanceInput = { gameDate: '2018-01-02', sessionPhase: 'preopen', isTradingDate: true, pendingOrderCount: 0, hasPendingAttention: false, autoplayRunning: false, ready: true, hasError: false, processing: false }

describe('createHomeGuidance', () => {
  const cases = [
    [{ ready: false }, 'loading'],
    [{}, 'preopen-empty'],
    [{ pendingOrderCount: 2 }, 'preopen-ordered'],
    [{ sessionPhase: 'opened' }, 'opened'],
    [{ sessionPhase: 'closed' }, 'closed'],
    [{ hasPendingAttention: true }, 'attention-required'],
    [{ autoplayRunning: true }, 'autoplay'],
    [{ hasError: true }, 'blocked'],
  ] as const

  for (const [overrides, state] of cases) {
    it(`${state} 상태를 안내한다`, () => {
      expect(createHomeGuidance({ ...base, ...overrides }).state).toBe(state)
    })
  }

  it('미래 가격을 언급하지 않고 현재 단계와 공개 정보만 안내한다', () => {
    const guidance = createHomeGuidance({ ...base, sessionPhase: 'opened' })
    expect(guidance.currentStage).toBe('2018-01-02 · 장중')
    expect(guidance.recommendation).toContain('현재 공개된 시가')
    expect(guidance.recommendation).not.toMatch(/종가 예상|오를|내릴/)
  })
})
