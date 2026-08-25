import { describe, expect, it } from 'vitest'
import { isoDateInTimeZone } from './date'

describe('build date timezone handling', () => {
  it('uses the Korean calendar date across the UTC midnight boundary', () => {
    const instant = new Date('2026-08-25T15:30:00Z')
    expect(isoDateInTimeZone(instant, 'Asia/Seoul')).toBe('2026-08-26')
    expect(isoDateInTimeZone(instant, 'UTC')).toBe('2026-08-25')
  })
})
