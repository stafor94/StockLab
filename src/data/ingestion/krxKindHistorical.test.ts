import { describe, expect, it } from 'vitest'
import {
  normalizeKrxKindHistoricalResponse,
  parseKrxKindIssuerInfo,
} from './krxKindHistorical'

describe('KRX KIND issuer lookup', () => {
  it('resolves the official Samsung Electronics issuer code from KRX XML', () => {
    const xml = `
      <items><item>
        <isurcd>00593</isurcd>
        <comabbr><![CDATA[삼성전자]]></comabbr>
        <repisucd>KR7005930003</repisucd>
        <repisusrtcd>A005930</repisusrtcd>
      </item></items>
    `

    expect(parseKrxKindIssuerInfo(xml, '005930')).toEqual({
      issuerCode: '00593',
      isin: 'KR7005930003',
      shortCode: '005930',
      name: '삼성전자',
    })
  })

  it('rejects a mismatched lookup result', () => {
    const xml = `
      <items><item>
        <isurcd>00066</isurcd>
        <comabbr><![CDATA[SK하이닉스]]></comabbr>
        <repisucd>KR7000660001</repisucd>
        <repisusrtcd>A000660</repisusrtcd>
      </item></items>
    `

    expect(() => parseKrxKindIssuerInfo(xml, '005930')).toThrow(/mismatch/)
  })
})

describe('KRX KIND historical OHLCV', () => {
  it('preserves raw pre/post Samsung 50:1 split prices without back-adjustment', () => {
    const response = `
      var dataDisclsAnalysisChart = [
        {"open":2669000,"admnt":606216,"gongsi":true,"high":2682000,"low":2622000,"date":"2018-04-27","close":2650000},
        {"open":53000,"admnt":39565391,"gongsi":true,"high":53900,"low":51800,"date":"2018-05-04","close":51900},
        {"open":52600,"admnt":23104720,"gongsi":true,"high":53200,"low":51900,"date":"2018-05-08","close":52600}
      ];
      var valStockName = '삼성전자';
    `

    expect(normalizeKrxKindHistoricalResponse(response)).toEqual([
      { date: '2018-04-27', open: 2669000, high: 2682000, low: 2622000, close: 2650000, volume: 606216 },
      { date: '2018-05-04', open: 53000, high: 53900, low: 51800, close: 51900, volume: 39565391 },
      { date: '2018-05-08', open: 52600, high: 53200, low: 51900, close: 52600, volume: 23104720 },
    ])
  })

  it('normalizes ETF rows from the same official chart series', () => {
    const response = `
      var dataDisclsAnalysisChart = [
        {"open":32910,"admnt":4611286,"gongsi":true,"high":33005,"low":32805,"date":"2018-01-02","close":32925},
        {"open":33070,"admnt":6665204,"gongsi":true,"high":33170,"low":32990,"date":"2018-01-03","close":33065}
      ];
    `

    expect(normalizeKrxKindHistoricalResponse(response)).toEqual([
      { date: '2018-01-02', open: 32910, high: 33005, low: 32805, close: 32925, volume: 4611286 },
      { date: '2018-01-03', open: 33070, high: 33170, low: 32990, close: 33065, volume: 6665204 },
    ])
  })

  it('rejects malformed OHLC bounds', () => {
    const response = `var dataDisclsAnalysisChart = [
      {"open":100,"admnt":1,"high":90,"low":80,"date":"2018-01-02","close":85}
    ];`
    expect(() => normalizeKrxKindHistoricalResponse(response)).toThrow(/OHLC bounds/)
  })
})
