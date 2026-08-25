import { describe, expect, it } from 'vitest'
import { normalizeNasdaqSplitCalendarPayload } from './nasdaq-splits'

describe('Nasdaq split calendar parser', () => {
  it('finds forward and reverse split rows without depending on presentation nesting', () => {
    const payload = {
      data: {
        calendar: {
          rows: [
            { symbol: 'AAA', ratio: '4 : 1', executionDate: '08/31/2020' },
            { symbol: 'BBB', ratio: '1 : 10', executionDate: '05/01/2024' },
          ],
        },
      },
    }
    expect(normalizeNasdaqSplitCalendarPayload(payload, '2020-08-31')).toEqual([
      { symbol: 'AAA', effectiveDate: '2020-08-31', numerator: 4, denominator: 1 },
      { symbol: 'BBB', effectiveDate: '2024-05-01', numerator: 1, denominator: 10 },
    ])
  })
})
