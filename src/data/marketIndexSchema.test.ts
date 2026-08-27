import { describe, expect, it } from 'vitest'
import { parseMarketIndexManifest, parseMarketIndexSeries } from './marketIndexSchema'

describe('market index schema', () => {
  it('parses a dedicated major-index manifest and historical series', () => {
    const manifest = parseMarketIndexManifest({
      schemaVersion: 1,
      indices: [{ id: 'KOSPI', alias: '코스피', market: 'KR', dataPath: 'kr/KOSPI.json' }],
    })
    expect(manifest.indices[0]).toMatchObject({ id: 'KOSPI', market: 'KR' })

    const series = parseMarketIndexSeries({
      schemaVersion: 1,
      id: 'KOSPI',
      alias: '코스피',
      market: 'KR',
      source: {
        authoritativeProvider: 'KRX Data Marketplace',
        generatedAt: '2026-08-27T00:00:00.000Z',
        reference: 'https://data.krx.co.kr/',
      },
      bars: [
        { date: '2017-12-28', open: 2430, high: 2440, low: 2420, close: 2436, volume: 250000 },
        { date: '2017-12-29', open: 2437, high: 2470, low: 2435, close: 2467, volume: 300000 },
      ],
    })
    expect(series.bars.at(-1)?.close).toBe(2467)
  })

  it('rejects duplicate or unordered index bars', () => {
    expect(() => parseMarketIndexSeries({
      schemaVersion: 1,
      id: 'KOSPI',
      alias: '코스피',
      market: 'KR',
      source: {
        authoritativeProvider: 'KRX Data Marketplace',
        generatedAt: '2026-08-27T00:00:00.000Z',
        reference: 'https://data.krx.co.kr/',
      },
      bars: [
        { date: '2018-01-02', open: 2470, high: 2480, low: 2460, close: 2475, volume: null },
        { date: '2018-01-02', open: 2471, high: 2481, low: 2461, close: 2476, volume: null },
      ],
    })).toThrow(/unique and ordered/)
  })
})
