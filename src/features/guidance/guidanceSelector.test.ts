import { describe, expect, it } from 'vitest'
import { createInitialSave } from '../../game/save'
import { selectGuidance } from './guidanceSelector'

describe('selectGuidance', () => {
  it('recommends the market first without requiring a preopen order', () => {
    const model = selectGuidance(createInitialSave())
    expect(model.recommendedAction).toBe('open-market')
    expect(model.navigation.시장.isRecommended).toBe(true)
    expect(model.needsSkipOrderConfirmation).toBe(false)
    expect(model.checklist).toHaveLength(6)
  })

  it('keeps the market recommended after opening until the first open-price trade', () => {
    const initial = createInitialSave()
    const visited = { ...initial, guidance: { ...initial.guidance, experienced: ['market-visited' as const] } }
    expect(selectGuidance(visited).recommendedAction).toBe('open-session')
    expect(selectGuidance({ ...visited, marketSessionPhase: 'opened' }).recommendedAction).toBe('open-market')
    const traded = {
      ...visited,
      marketSessionPhase: 'opened' as const,
      guidance: { ...visited.guidance, experienced: ['market-visited' as const, 'order-or-skip-confirmed' as const] },
    }
    expect(selectGuidance(traded).recommendedAction).toBe('close-session')
    expect(selectGuidance({ ...visited, marketSessionPhase: 'closed' }).recommendedAction).toBe('next-day')
  })

  it('supplies textual reasons for attention badges', () => {
    const initial = createInitialSave()
    const model = selectGuidance({
      ...initial,
      loan: { ...initial.loan, status: 'overdue', consecutiveMissedMonths: 2 },
      pendingImportantNews: [{ newsId: 'N1', publishedDate: '2018-01-01', revealDate: '2018-01-02', timing: 'POST_CLOSE', category: 'MARKET', market: 'GLOBAL', headline: '소식', summary: '요약' }],
    })
    expect(model.navigation.뉴스).toMatchObject({ attentionCount: 1, attentionReason: expect.stringContaining('중요 뉴스') })
    expect(model.navigation.자산).toMatchObject({ attentionCount: 2, attentionReason: expect.stringContaining('대출') })
  })
})
