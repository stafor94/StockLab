import { describe, expect, it } from 'vitest'
import { parseSecSharesSnapshotConfig, resolveSecSharesSnapshots } from './sec-shares-snapshots'

describe('verified SEC shares snapshots', () => {
  it('prefers tracked snapshots without loading live SEC company facts', async () => {
    const verified = parseSecSharesSnapshotConfig({
      schemaVersion: 1,
      assets: {
        U012: [
          { asOfDate: '2026-07-29', availableFrom: '2026-08-05', sharesOutstanding: 118005057, form: '10-Q' },
        ],
      },
    })
    let loadCalls = 0
    const snapshots = await resolveSecSharesSnapshots('U012', verified, async () => {
      loadCalls += 1
      return {}
    })

    expect(loadCalls).toBe(0)
    expect(snapshots).toEqual([
      { asOfDate: '2026-07-29', availableFrom: '2026-08-05', sharesOutstanding: 118005057, form: '10-Q' },
    ])
  })

  it('falls back to normalized SEC company facts when no tracked snapshot exists', async () => {
    const verified = parseSecSharesSnapshotConfig({ schemaVersion: 1, assets: {} })
    let loadCalls = 0
    const snapshots = await resolveSecSharesSnapshots('U099', verified, async () => {
      loadCalls += 1
      return { facts: { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
        { end: '2026-07-29', filed: '2026-08-05', form: '10-Q', accn: '0001', val: 123 },
      ] } } } } }
    })

    expect(loadCalls).toBe(1)
    expect(snapshots).toEqual([
      { asOfDate: '2026-07-29', availableFrom: '2026-08-05', sharesOutstanding: 123, form: '10-Q' },
    ])
  })

  it('rejects malformed tracked snapshots', () => {
    expect(() => parseSecSharesSnapshotConfig({
      schemaVersion: 1,
      assets: {
        U012: [
          { asOfDate: '2026-07-29', availableFrom: '2026-08-05', sharesOutstanding: 0, form: '10-Q' },
        ],
      },
    })).toThrow('sharesOutstanding must be a positive safe integer')
  })
})
