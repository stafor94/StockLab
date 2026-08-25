import { describe, expect, it } from 'vitest'
import {
  nasdaqHistoricalTotalRecords,
  normalizeNasdaqHistoricalPayload,
} from './nasdaqHistorical'

describe('Nasdaq Historical Quotes normalizer', () => {
  it('parses the official tradesTable payload and sorts rows ascending', () => {
    const payload = {
      data: {
        totalRecords: 2,
        tradesTable: {
          rows: [
            { date: '08/31/2020', close: '$129.04', volume: '225,702,700', open: '$127.58', high: '$131.00', low: '$126.00' },
            { date: '08/28/2020', close: '$124.8075', volume: '187,629,920', open: '$126.0125', high: '$126.4425', low: '$124.5775' },
          ],
        },
      },
    }
    expect(normalizeNasdaqHistoricalPayload(payload)).toEqual([
      { date: '2020-08-28', open: 126.0125, high: 126.4425, low: 124.5775, close: 124.8075, volume: 187629920 },
      { date: '2020-08-31', open: 127.58, high: 131, low: 126, close: 129.04, volume: 225702700 },
    ])
    expect(nasdaqHistoricalTotalRecords(payload)).toBe(2)
  })

  it('preserves a minor authoritative Nasdaq OHLC discrepancy without clamping', () => {
    const payload = {
      data: {
        totalRecords: 1,
        tradesTable: {
          rows: [
            { date: '06/05/2023', open: '$34.45', high: '$34.375', low: '$33.66', close: '$34.13', volume: '100' },
          ],
        },
      },
    }
    expect(normalizeNasdaqHistoricalPayload(payload)).toEqual([
      { date: '2023-06-05', open: 34.45, high: 34.375, low: 33.66, close: 34.13, volume: 100 },
    ])
  })

  it('still rejects materially inconsistent OHLC rows', () => {
    const payload = {
      data: {
        totalRecords: 1,
        tradesTable: {
          rows: [
            { date: '06/05/2023', open: '$100', high: '$90', low: '$80', close: '$95', volume: '100' },
          ],
        },
      },
    }
    expect(() => normalizeNasdaqHistoricalPayload(payload)).toThrow(/materially inconsistent/)
  })

  it('accepts an empty pre-listing window without fabricating bars', () => {
    expect(normalizeNasdaqHistoricalPayload({ data: null })).toEqual([])
  })
})
