import { describe, expect, it } from 'vitest'
import { mergeCorporateEventDatasets, parseCorporateEventDataset } from './corporateEventSchema'

function dataset(id: string, assetId: string, date: string) {
  return parseCorporateEventDataset({
    schemaVersion: 1,
    coverage: { from: '2018-01-01', to: '2026-08-25' },
    source: { mode: 'curated-partial', generatedAt: '2026-08-26T00:00:00.000Z' },
    events: [{
      id,
      assetId,
      date,
      timing: 'PRE_OPEN',
      type: 'LISTING',
      title: '상장',
      summary: '상장 이벤트',
      important: true,
      source: { provider: 'TEST', reference: 'https://example.com/source' },
      payload: {},
    }],
  })
}

describe('corporate event dataset shards', () => {
  it('merges shards into deterministic date/id order', () => {
    const merged = mergeCorporateEventDatasets([
      dataset('E2', 'K002', '2021-01-02'),
      dataset('E1', 'K001', '2020-01-02'),
    ])
    expect(merged.events.map((event) => event.id)).toEqual(['E1', 'E2'])
    expect(merged.source.mode).toBe('curated-partial')
  })

  it('rejects duplicate event ids across shards', () => {
    expect(() => mergeCorporateEventDatasets([
      dataset('E1', 'K001', '2020-01-02'),
      dataset('E1', 'K002', '2021-01-02'),
    ])).toThrow('duplicate corporate event id across shards')
  })
})
