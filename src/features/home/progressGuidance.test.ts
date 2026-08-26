import { describe, expect, it } from 'vitest'
import { createProgressGuidance } from './progressGuidance'

const base = {
  sessionPhase: 'preopen' as const,
  primaryActionLabel: '장 시작',
  timelineMessage: '개장 전입니다.',
  timelineReady: true,
  pendingImportantNews: 0,
  pendingImportantEvents: 0,
  loanOverdue: false,
  gameOver: false,
}

describe('createProgressGuidance', () => {
  it('maps the normal session to the actual primary action', () => {
    expect(createProgressGuidance(base)).toMatchObject({ actionLabel: '장 시작', actionTarget: 'RUN_PRIMARY', severity: 'info' })
  })

  it('keeps the close-price trading window visible after market close', () => {
    expect(createProgressGuidance({ ...base, sessionPhase: 'closed', primaryActionLabel: '다음 날', timelineMessage: '오늘 종가로 주문할 수 있습니다.' })).toMatchObject({
      title: '장 마감 · 종가 주문 가능',
      actionLabel: '다음 날',
      actionTarget: 'RUN_PRIMARY',
    })
  })

  it('prioritizes blocking news over normal progression', () => {
    expect(createProgressGuidance({ ...base, pendingImportantNews: 2 })).toMatchObject({ actionTarget: 'REVIEW_NEWS', severity: 'critical' })
  })

  it('offers recovery when required data is not ready', () => {
    expect(createProgressGuidance({ ...base, timelineReady: false })).toMatchObject({ actionTarget: 'RETRY_DATA', severity: 'warning' })
  })
})
