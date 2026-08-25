import { describe, expect, it } from 'vitest'
import { getKrxEndpointForDate, getKrxSourceEndpoints, type KrxAssetSource } from './source-map'

const source: KrxAssetSource = {
  provider: 'KRX',
  symbol: '000000',
  endpoint: 'ksq_bydd_trd',
  endpointChanges: [{ effectiveFrom: '2018-02-09', endpoint: 'stk_bydd_trd' }],
}

describe('KRX source venue history', () => {
  it('uses the endpoint that was effective on the requested trading date', () => {
    expect(getKrxEndpointForDate(source, '2018-02-08')).toBe('ksq_bydd_trd')
    expect(getKrxEndpointForDate(source, '2018-02-09')).toBe('stk_bydd_trd')
    expect(getKrxEndpointForDate(source, '2026-08-25')).toBe('stk_bydd_trd')
  })

  it('reports every endpoint required by the history builder', () => {
    expect(getKrxSourceEndpoints(source)).toEqual(['ksq_bydd_trd', 'stk_bydd_trd'])
  })
})
