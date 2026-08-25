import { describe, expect, it } from 'vitest'
import { createInitialSave, SAVE_SCHEMA_VERSION, SAVE_STORAGE_KEY } from './save'

describe('initial game save', () => {
  it('starts on 2018-01-01 with a 10,000,000 KRW loan-funded seed', () => {
    const save = createInitialSave()

    expect(save.gameDate).toBe('2018-01-01')
    expect(save.krwCash).toBe(10_000_000)
    expect(save.usdCash).toBe(0)
    expect(save.loanPrincipal).toBe(10_000_000)
    expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
  })

  it('uses one stable localStorage slot', () => {
    expect(SAVE_STORAGE_KEY).toBe('stocklab.save')
  })
})
