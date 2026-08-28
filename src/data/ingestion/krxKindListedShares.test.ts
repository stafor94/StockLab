import { describe, expect, it } from 'vitest'
import { parseKrxKindListedSharesHtml } from './krxKindListedShares'

const html = `
<table>
  <thead><tr><th>구분</th><th>종목명</th><th>종목코드</th><th>상장일</th><th>상장주식수(천주)</th></tr></thead>
  <tbody>
    <tr><td>주권</td><td>삼성전자우</td><td>KR7005931001</td><td>1989-09-25</td><td>822,887</td></tr>
    <tr><td>주권</td><td>삼성전자</td><td>KR7005930003</td><td>1975-06-11</td><td>5,969,783</td></tr>
    <tr><td>ETF</td><td>KODEX 200 &amp; Test</td><td>KR7069500007</td><td>2002-10-14</td><td>268,450</td></tr>
  </tbody>
</table>`

describe('KRX KIND listed-share parsing', () => {
  it('uses security-level rows and converts reported thousands of shares to shares', () => {
    expect(parseKrxKindListedSharesHtml(html, new Set(['005930', '069500']))).toEqual([
      { symbol: '005930', name: '삼성전자', listedShares: 5_969_783_000 },
      { symbol: '069500', name: 'KODEX 200 & Test', listedShares: 268_450_000 },
    ])
  })

  it('rejects the company-level detail table', () => {
    expect(() => parseKrxKindListedSharesHtml(
      '<table><tr><th>회사명</th><th>종목코드</th><th>상장주식수(천주)</th></tr></table>',
      new Set(['005930']),
    )).toThrow(/security-level detail table/)
  })
})
