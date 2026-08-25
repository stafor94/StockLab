import type { MarketCode } from '../../types/market'
import { ceilUsdCent, roundCurrency } from './currency'

export type KrStockVenue = 'KOSPI' | 'KOSDAQ'

interface KrTaxRule {
  effectiveFrom: string
  kospiTransactionTaxRate: number
  kosdaqTransactionTaxRate: number
}

interface UsSection31Rule {
  effectiveFrom: string
  dollarsPerMillion: number
}

interface FinraTafRule {
  effectiveFrom: string
  perShareRate: number
  maxPerTrade: number
}

export interface HistoricalSellCosts {
  transactionTax: number
  ruralSpecialTax: number
  secSection31Fee: number
  finraTaf: number
  total: number
}

export interface HistoricalSellCostInput {
  assetId: string
  market: MarketCode
  grossAmount: number
  quantity: number
  unitPrice: number
  tradeDate: string
}

export const KR_RURAL_SPECIAL_TAX_RATE = 0.0015

const KR_TAX_RULES: readonly KrTaxRule[] = [
  { effectiveFrom: '2018-01-01', kospiTransactionTaxRate: 0.0015, kosdaqTransactionTaxRate: 0.003 },
  { effectiveFrom: '2019-06-03', kospiTransactionTaxRate: 0.001, kosdaqTransactionTaxRate: 0.0025 },
  { effectiveFrom: '2021-01-01', kospiTransactionTaxRate: 0.0008, kosdaqTransactionTaxRate: 0.0023 },
  { effectiveFrom: '2023-01-01', kospiTransactionTaxRate: 0.0005, kosdaqTransactionTaxRate: 0.002 },
  { effectiveFrom: '2024-01-01', kospiTransactionTaxRate: 0.0003, kosdaqTransactionTaxRate: 0.0018 },
  { effectiveFrom: '2025-01-01', kospiTransactionTaxRate: 0, kosdaqTransactionTaxRate: 0.0015 },
  { effectiveFrom: '2026-01-01', kospiTransactionTaxRate: 0.0005, kosdaqTransactionTaxRate: 0.002 },
]

const US_SECTION_31_RULES: readonly UsSection31Rule[] = [
  { effectiveFrom: '2018-01-01', dollarsPerMillion: 23.1 },
  { effectiveFrom: '2018-05-22', dollarsPerMillion: 13 },
  { effectiveFrom: '2019-04-16', dollarsPerMillion: 20.7 },
  { effectiveFrom: '2020-02-19', dollarsPerMillion: 22.1 },
  { effectiveFrom: '2021-02-25', dollarsPerMillion: 5.1 },
  { effectiveFrom: '2022-05-14', dollarsPerMillion: 22.9 },
  { effectiveFrom: '2023-02-27', dollarsPerMillion: 8 },
  { effectiveFrom: '2024-05-22', dollarsPerMillion: 27.8 },
  { effectiveFrom: '2025-05-14', dollarsPerMillion: 0 },
  { effectiveFrom: '2026-04-04', dollarsPerMillion: 20.6 },
]

const FINRA_TAF_RULES: readonly FinraTafRule[] = [
  { effectiveFrom: '2018-01-01', perShareRate: 0.000119, maxPerTrade: 5.95 },
  { effectiveFrom: '2022-01-01', perShareRate: 0.00013, maxPerTrade: 6.49 },
  { effectiveFrom: '2023-01-01', perShareRate: 0.000145, maxPerTrade: 7.27 },
  { effectiveFrom: '2024-01-01', perShareRate: 0.000166, maxPerTrade: 8.3 },
  { effectiveFrom: '2026-01-01', perShareRate: 0.000195, maxPerTrade: 9.79 },
]

const KOSPI_STOCK_IDS = new Set([
  'K001', 'K002', 'K003', 'K004', 'K005', 'K006', 'K007', 'K008', 'K009', 'K010',
  'K011', 'K012', 'K013', 'K014', 'K015', 'K016', 'K018', 'K019', 'K020', 'K021',
  'K022', 'K023', 'K024', 'K025', 'K026', 'K027', 'K028', 'K029', 'K030', 'K031',
  'K032', 'K033', 'K034', 'K035', 'K036', 'K038', 'K039', 'K040',
])

function effectiveRule<T extends { effectiveFrom: string }>(rules: readonly T[], date: string): T {
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index]
    if (rule && date >= rule.effectiveFrom) return rule
  }
  throw new Error(`No historical trading-cost rule is available for ${date}`)
}

export function getKrStockVenue(assetId: string, tradeDate: string): KrStockVenue {
  if (assetId === 'K017') return tradeDate < '2018-02-09' ? 'KOSDAQ' : 'KOSPI'
  if (assetId === 'K037') return 'KOSDAQ'
  if (KOSPI_STOCK_IDS.has(assetId)) return 'KOSPI'
  throw new Error(`Korean stock venue is not configured for ${assetId}`)
}

function zeroCosts(): HistoricalSellCosts {
  return {
    transactionTax: 0,
    ruralSpecialTax: 0,
    secSection31Fee: 0,
    finraTaf: 0,
    total: 0,
  }
}

function calculateKoreanCosts(input: HistoricalSellCostInput): HistoricalSellCosts {
  if (/^KE\d{3}$/.test(input.assetId)) return zeroCosts()
  if (!/^K\d{3}$/.test(input.assetId)) throw new Error(`Invalid Korean asset id: ${input.assetId}`)

  const venue = getKrStockVenue(input.assetId, input.tradeDate)
  const rule = effectiveRule(KR_TAX_RULES, input.tradeDate)
  const transactionTaxRate = venue === 'KOSPI'
    ? rule.kospiTransactionTaxRate
    : rule.kosdaqTransactionTaxRate
  const transactionTax = roundCurrency(input.grossAmount * transactionTaxRate, 'KRW')
  const ruralSpecialTax = venue === 'KOSPI'
    ? roundCurrency(input.grossAmount * KR_RURAL_SPECIAL_TAX_RATE, 'KRW')
    : 0

  return {
    transactionTax,
    ruralSpecialTax,
    secSection31Fee: 0,
    finraTaf: 0,
    total: transactionTax + ruralSpecialTax,
  }
}

function calculateUsCosts(input: HistoricalSellCostInput): HistoricalSellCosts {
  if (!/^U(?:E)?\d{3}$/.test(input.assetId)) throw new Error(`Invalid U.S. asset id: ${input.assetId}`)

  const section31 = effectiveRule(US_SECTION_31_RULES, input.tradeDate)
  const taf = effectiveRule(FINRA_TAF_RULES, input.tradeDate)
  const secSection31Fee = ceilUsdCent((input.grossAmount * section31.dollarsPerMillion) / 1_000_000)
  const finraTaf = input.unitPrice < taf.perShareRate
    ? 0
    : ceilUsdCent(Math.min(input.quantity * taf.perShareRate, taf.maxPerTrade))

  return {
    transactionTax: 0,
    ruralSpecialTax: 0,
    secSection31Fee,
    finraTaf,
    total: roundCurrency(secSection31Fee + finraTaf, 'USD'),
  }
}

export function calculateHistoricalSellCosts(input: HistoricalSellCostInput): HistoricalSellCosts {
  if (!Number.isFinite(input.grossAmount) || input.grossAmount < 0) throw new Error('grossAmount must be non-negative')
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('quantity must be a positive integer')
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) throw new Error('unitPrice must be positive')
  return input.market === 'KR' ? calculateKoreanCosts(input) : calculateUsCosts(input)
}
