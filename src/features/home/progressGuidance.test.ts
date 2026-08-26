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

  it('prioritizes blocking news over normal progression', () => {
    expect(createProgressGuidance({ ...base, pendingImportantNews: 2 })).toMatchObject({ actionTarget: 'REVIEW_NEWS', severity: 'critical' })
  })

  it('offers recovery when required data is not ready', () => {
    expect(createProgressGuidance({ ...base, timelineReady: false })).toMatchObject({ actionTarget: 'RETRY_DATA', severity: 'warning' })
  })
})
