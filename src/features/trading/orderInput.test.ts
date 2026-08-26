import { describe, expect, it } from 'vitest'
import { removeLastInputCharacter } from './orderInput'

describe('removeLastInputCharacter', () => {
  it('removes exactly one trailing character at a time', () => {
    expect(removeLastInputCharacter('1234')).toBe('123')
    expect(removeLastInputCharacter('123')).toBe('12')
    expect(removeLastInputCharacter('12')).toBe('1')
    expect(removeLastInputCharacter('1')).toBe('')
  })

  it('is safe for an empty input', () => {
    expect(removeLastInputCharacter('')).toBe('')
  })
})
