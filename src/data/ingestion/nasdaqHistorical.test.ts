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

  it('accepts an empty pre-listing window without fabricating bars', () => {
    expect(normalizeNasdaqHistoricalPayload({ data: null })).toEqual([])
  })
})
