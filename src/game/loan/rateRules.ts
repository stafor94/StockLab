import type { BaseRateSeries } from '../../types/rates'

export const WS_LOAN_MARGIN_PERCENTAGE_POINTS = 3
export const WS_OVERDUE_PREMIUM_PERCENTAGE_POINTS = 3
export const WS_OVERDUE_RATE_CAP = 15
export const WS_PRINCIPAL_REPAYMENT_UNIT = 1_000_000

export function getBaseRateForDate(series: BaseRateSeries, date: string): number {
  if (date < series.coverage.from || date > series.coverage.to) {
    throw new Error(`한국은행 기준금리 데이터 범위를 벗어났습니다: ${date}`)
  }
  let matched: number | null = null
  for (const point of series.rates) {
    if (point.date > date) break
    matched = point.annualRate
  }
  if (matched === null) throw new Error(`해당 날짜 이전의 한국은행 기준금리가 없습니다: ${date}`)
  return matched
}

export function getWsLoanAnnualRate(series: BaseRateSeries, date: string): number {
  return getBaseRateForDate(series, date) + WS_LOAN_MARGIN_PERCENTAGE_POINTS
}

export function getWsOverdueAnnualRate(series: BaseRateSeries, date: string): number {
  return Math.min(
    getWsLoanAnnualRate(series, date) + WS_OVERDUE_PREMIUM_PERCENTAGE_POINTS,
    WS_OVERDUE_RATE_CAP,
  )
}
