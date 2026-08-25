# Historical Trading Costs

StockLab separates the fictional WS Securities commission schedule from statutory or regulatory sell-side costs. All rules are selected by the in-game trade date; current rates are never applied retroactively to historical trades.

## WS Securities commissions

These are representative fictional broker fees and are not intended to reproduce a specific real brokerage account.

| Market | Buy | Sell |
| --- | ---: | ---: |
| Korea | 0.015% | 0.015% |
| U.S. | 0.07% | 0.07% |

## Korean stock sale taxes

KOSPI sales also incur the 0.15% rural special tax. KOSDAQ sales do not. The table below shows the securities transaction tax component and, for convenience, the resulting total sell tax.

| Effective period | KOSPI transaction tax | KOSPI rural special tax | KOSPI total | KOSDAQ transaction tax |
| --- | ---: | ---: | ---: | ---: |
| 2018-01-01 – 2019-06-02 | 0.15% | 0.15% | 0.30% | 0.30% |
| 2019-06-03 – 2020-12-31 | 0.10% | 0.15% | 0.25% | 0.25% |
| 2021-01-01 – 2022-12-31 | 0.08% | 0.15% | 0.23% | 0.23% |
| 2023-01-01 – 2023-12-31 | 0.05% | 0.15% | 0.20% | 0.20% |
| 2024-01-01 – 2024-12-31 | 0.03% | 0.15% | 0.18% | 0.18% |
| 2025-01-01 – 2025-12-31 | 0.00% | 0.15% | 0.15% | 0.15% |
| 2026-01-01 onward | 0.05% | 0.15% | 0.20% | 0.20% |

Implementation sources:
- National Law Information Center, 2019 reduction and 2019-06-03 effective date: https://www.law.go.kr/lsInfoP.do?lsiSeq=208731
- National Law Information Center, 2021 rates: https://www.law.go.kr/lsInfoP.do?lsiSeq=225167&viewCls=lsRvsDocInfoR
- National Law Information Center, 2023–2025 scheduled rates: https://www.law.go.kr/lsInfoP.do?lsiSeq=247529
- National Law Information Center, 2026 restoration: https://www.law.go.kr/lsInfoP.do?chrClsCd=010102&lsiSeq=282431&viewCls=lsRvsDocInfoR
- Rural Special Tax Act, 0.15% on covered securities-market transfer value: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032879999

### Korean ETF exception

KRX explains that ETFs are funds rather than stock certificates and are exempt from securities transaction tax. StockLab therefore charges no Korean securities transaction tax or KOSPI rural special tax to `KE***` assets. This exemption does not mean every ETF-related tax is zero; holding-period taxation, distributions, and other income-tax rules belong to a later tax/corporate-action layer.

KRX source: https://global.krx.co.kr/contents/GLB/06/0605/0605010103/GLB0605010103.jsp

### Venue history

Most Korean stocks in the current catalog are KOSPI. `K037` is KOSDAQ. `K017` is treated as KOSDAQ through 2018-02-08 and KOSPI from 2018-02-09, matching its historical transfer listing. Unknown Korean stock IDs deliberately throw instead of silently receiving the wrong tax class.

KRX KIND source for the 2018-02-09 transfer listing: https://kind.krx.co.kr/listinvstg/listinvstgcom.do?bizProcNo=20171201000068&method=searchListInvstgCorpDetail

## U.S. sell regulatory pass-through

WS Securities passes through two U.S. sell-side regulatory costs in the simulation. Section 31 is legally assessed through SROs rather than directly by the SEC to retail customers; the SEC notes that broker-dealers generally pass related per-transaction charges to customers. StockLab models that common pass-through explicitly.

SEC background: https://www.sec.gov/rules-regulations/fee-rate-advisories/section-31-transaction-fees-basic-information-firms

### Section 31 rate

| Effective period | Rate per $1,000,000 of covered sale value |
| --- | ---: |
| 2018-01-01 – 2018-05-21 | $23.10 |
| 2018-05-22 – 2019-04-15 | $13.00 |
| 2019-04-16 – 2020-02-18 | $20.70 |
| 2020-02-19 – 2021-02-24 | $22.10 |
| 2021-02-25 – 2022-05-13 | $5.10 |
| 2022-05-14 – 2023-02-26 | $22.90 |
| 2023-02-27 – 2024-05-21 | $8.00 |
| 2024-05-22 – 2025-05-13 | $27.80 |
| 2025-05-14 – 2026-04-03 | $0.00 |
| 2026-04-04 onward | $20.60 |

SEC fee-rate archive: https://www.sec.gov/rules-regulations/fee-rate-advisories

Current relevant advisories:
- FY2025 zero-rate change: https://www.sec.gov/rules-regulations/fee-rate-advisories/2025-2
- FY2026 $20.60/million change: https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2

### FINRA Trading Activity Fee (TAF)

For covered equity-security sales:

| Year | Per-share rate | Maximum per trade |
| --- | ---: | ---: |
| 2018–2021 | $0.000119 | $5.95 |
| 2022 | $0.000130 | $6.49 |
| 2023 | $0.000145 | $7.27 |
| 2024–2025 | $0.000166 | $8.30 |
| 2026 | $0.000195 | $9.79 |

If the execution price per share is below the applicable TAF per-share rate, StockLab follows the FINRA rule and assesses no TAF.

FINRA sources:
- 2022–2024 phased schedule: https://www.finra.org/sites/default/files/2020-10/SR-FINRA-2020-032.pdf
- 2026 phased schedule: https://www.finra.org/sites/default/files/2024-11/sr-finra-2024-019.pdf

## Rounding and settlement

- KRW commission and tax components are truncated to whole won using the shared KRW money-rounding utility.
- USD WS commission is rounded to cents.
- Positive Section 31 and FINRA customer pass-through amounts are rounded up to the next cent per trade; this is a documented fictional WS Securities billing policy, not a statement that the regulator itself bills retail customers that way.
- Sell proceeds entering the settlement queue are `gross proceeds - WS commission - date-applicable tax/regulatory costs`.
- Settlement timing remains independent: Korea T+2; U.S. T+2 through 2024-05-27 and T+1 from 2024-05-28.

## Out of scope for v0.8.0

This module does not calculate capital-gains tax, dividend/distribution withholding, Korean ETF holding-period income tax, corporate-action taxation, or account-specific tax exemptions. Those require separate event/tax modules and must not be mixed into execution-price calculations.
