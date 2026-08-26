import { describe, expect, it } from 'vitest'
import { selectNextAction, type GuidanceState } from './guidanceSelectors'

const base: GuidanceState = { phase: 'preopen', pendingImportantAlert: false, autoplayRunning: false, error: null, pendingOrderCount: 0 }

describe('selectNextAction', () => {
  it.each([
    [{ ...base, phase: 'preopen' }, 'place-order'],
    [{ ...base, phase: 'opened' }, 'close-market'],
    [{ ...base, phase: 'closed' }, 'next-day'],
    [{ ...base, pendingImportantAlert: true }, 'review-alert'],
    [{ ...base, autoplayRunning: true }, 'pause-autoplay'],
    [{ ...base, error: '가격 데이터를 불러오지 못했습니다.' }, 'resolve-error'],
  ] satisfies Array<[GuidanceState, string]>)('$1 상태의 다음 행동을 선택한다', (state, step) => {
    expect(selectNextAction(state).step).toBe(step)
  })

  it('접수 주문이 있으면 장 시작을 안내한다', () => {
    expect(selectNextAction({ ...base, pendingOrderCount: 1 }).step).toBe('open-market')
  })
})
