import { describe, expect, it } from 'vitest'
import { parseSecTickerText, resolveSecCikForTicker } from './sec-edgar'

describe('SEC official ticker mapping parser', () => {
  it('normalizes the official tab-delimited ticker/CIK file into the resolver shape', () => {
    const payload = parseSecTickerText('ZZTESTA\t123456\nZZ-TESTB\t234567\n')
    expect(resolveSecCikForTicker(payload, 'ZZTESTA')).toBe(123456)
    expect(resolveSecCikForTicker(payload, 'ZZ.TESTB')).toBe(234567)
  })

  it('rejects an empty or unusable mapping file', () => {
    expect(() => parseSecTickerText('\ninvalid\n')).toThrow(/no usable ticker\/CIK mappings/)
  })
})
