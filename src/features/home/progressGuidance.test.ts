import { describe, expect, it } from 'vitest'
import { createProgressGuidance } from './progressGuidance'

const base = {
  primaryActionLabel: '국내장 시작',
  timelineMessage: '다음 이벤트: 국내장 시작',
  timelineReady: true,
  pendingImportantNews: 0,
  pendingImportantEvents: 0,
  loanOverdue: false,
  gameOver: false,
}

describe('createProgressGuidance', () => {
  it('maps the next market event to the actual primary action', () => {
    expect(createProgressGuidance(base)).toMatchObject({
      title: '다음 시장 이벤트',
      actionLabel: '국내장 시작',
      actionTarget: 'RUN_PRIMARY',
      severity: 'info',
    })
  })

  it('keeps market identity in the next event action', () => {
    expect(createProgressGuidance({ ...base, primaryActionLabel: '미국장 시작', timelineMessage: '다음 이벤트: 미국장 시작' })).toMatchObject({
      title: '다음 시장 이벤트',
      actionLabel: '미국장 시작',
      actionTarget: 'RUN_PRIMARY',
    })
  })

  it('does not replace the next market event with a loan review action while overdue', () => {
    expect(createProgressGuidance({ ...base, loanOverdue: true, primaryActionLabel: '미국장 마감', timelineMessage: '다음 이벤트: 미국장 마감' })).toMatchObject({
      title: '다음 시장 이벤트',
      actionLabel: '미국장 마감',
      actionTarget: 'RUN_PRIMARY',
      severity: 'info',
    })
  })

  it('prioritizes blocking news over normal progression', () => {
    expect(createProgressGuidance({ ...base, pendingImportantNews: 2 })).toMatchObject({ actionTarget: 'REVIEW_NEWS', severity: 'critical' })
  })

  it('offers recovery when required data is not ready', () => {
    expect(createProgressGuidance({ ...base, timelineReady: false })).toMatchObject({ actionTarget: 'RETRY_DATA', severity: 'warning' })
  })
})
