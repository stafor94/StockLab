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

  it('keeps the market recommended while either market is open until the first trade', () => {
    const initial = createInitialSave()
    const visited = { ...initial, guidance: { ...initial.guidance, experienced: ['market-visited' as const] } }
    expect(selectGuidance(visited).recommendedAction).toBe('next-day')

    const krOpened = {
      ...visited,
      marketSessions: {
        ...visited.marketSessions,
        KR: { phase: 'opened' as const, tradingDate: '2018-01-02' },
      },
    }
    expect(selectGuidance(krOpened).recommendedAction).toBe('open-market')

    const traded = {
      ...krOpened,
      guidance: { ...visited.guidance, experienced: ['market-visited' as const, 'order-or-skip-confirmed' as const] },
    }
    expect(selectGuidance(traded).recommendedAction).toBe('next-day')
  })

  it('keeps overdue loan attention visible after failures were acknowledged', () => {
    const initial = createInitialSave()
    const overdue = {
      ...initial,
      loan: {
        ...initial.loan,
        status: 'overdue' as const,
        consecutiveMissedMonths: 1,
        history: [
          { id: 'L000001', date: '2018-02-01', type: 'payment_failed' as const, amount: 0, note: '미납' },
        ],
      },
      guidance: { ...initial.guidance, seenLoanPaymentFailures: 1 },
    }

    expect(selectGuidance(overdue).navigation.자산).toMatchObject({
      attentionCount: 1,
      attentionReason: expect.stringContaining('연체'),
    })

    const resolved = {
      ...overdue,
      loan: { ...overdue.loan, status: 'current' as const },
    }
    expect(selectGuidance(resolved).navigation.자산.attentionCount).toBeUndefined()
  })
})
