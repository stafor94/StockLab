import type { FxRatePoint, FxRateSeries } from '../../types/fx'
import type {
  ExchangeQuote,
  ExchangeRecord,
  ExchangeRequest,
  ExchangeState,
} from './types'

export const WS_FX_BASE_SPREAD_RATE = 0.01
export const WS_FX_PREFERENTIAL_RATE = 0.95
export const WS_FX_EFFECTIVE_SPREAD_RATE = WS_FX_BASE_SPREAD_RATE * (1 - WS_FX_PREFERENTIAL_RATE)

function floorUsd(value: number): number {
  return Math.floor((value + Number.EPSILON) * 100) / 100
}

export function findUsdKrwRatePointForDate(series: FxRateSeries, gameDate: string): FxRatePoint | null {
  let result: FxRatePoint | null = null
  for (const row of series.rates) {
    if (row.date > gameDate) break
    result = row
  }
  return result
}

export function findUsdKrwRateForDate(series: FxRateSeries, gameDate: string): number | null {
  return findUsdKrwRatePointForDate(series, gameDate)?.usdKrw ?? null
}

export function quoteExchange(request: ExchangeRequest, referenceRate: number): ExchangeQuote {
  if (!Number.isFinite(referenceRate) || referenceRate <= 0) throw new Error('유효한 기준환율이 필요합니다.')
  if (!Number.isFinite(request.amount) || request.amount <= 0) throw new Error('환전 금액은 0보다 커야 합니다.')

  const spreadRate = WS_FX_EFFECTIVE_SPREAD_RATE
  if (request.direction === 'KRW_TO_USD') {
    const sourceAmount = Math.floor(request.amount)
    const appliedRate = referenceRate * (1 + spreadRate)
    const targetAmount = floorUsd(sourceAmount / appliedRate)
    if (targetAmount <= 0) throw new Error('환전 가능한 최소 금액보다 작습니다.')
    return {
      direction: request.direction,
      sourceAmount,
      targetAmount,
      referenceRate,
      appliedRate,
      spreadRate,
      feeEquivalentKrw: Math.max(0, sourceAmount - targetAmount * referenceRate),
    }
  }

  const appliedRate = referenceRate * (1 - spreadRate)
  const sourceAmount = floorUsd(request.amount)
  const targetAmount = Math.floor(sourceAmount * appliedRate)
  if (targetAmount <= 0) throw new Error('환전 가능한 최소 금액보다 작습니다.')
  return {
    direction: request.direction,
    sourceAmount,
    targetAmount,
    referenceRate,
    appliedRate,
    spreadRate,
    feeEquivalentKrw: Math.max(0, sourceAmount * referenceRate - targetAmount),
  }
}

export function executeExchange(
  state: ExchangeState,
  request: ExchangeRequest,
  referenceRate: number,
  date: string,
): { state: ExchangeState; record: ExchangeRecord } {
  if (state.marketSessionPhase !== 'preopen') throw new Error('환전은 개장 전 단계에서만 가능합니다.')
  const quote = quoteExchange(request, referenceRate)
  if (quote.direction === 'KRW_TO_USD' && quote.sourceAmount > state.krwCash) throw new Error('원화 현금이 부족합니다.')
  if (quote.direction === 'USD_TO_KRW' && quote.sourceAmount > state.usdCash + 1e-9) throw new Error('달러 현금이 부족합니다.')

  const record: ExchangeRecord = {
    id: `E${String(state.nextExchangeNumber).padStart(6, '0')}`,
    date,
    ...quote,
  }
  const next = quote.direction === 'KRW_TO_USD'
    ? {
        krwCash: state.krwCash - quote.sourceAmount,
        usdCash: Math.round((state.usdCash + quote.targetAmount) * 100) / 100,
      }
    : {
        krwCash: state.krwCash + quote.targetAmount,
        usdCash: Math.round((state.usdCash - quote.sourceAmount) * 100) / 100,
      }

  return {
    state: {
      ...state,
      ...next,
      exchangeHistory: [...state.exchangeHistory, record],
      nextExchangeNumber: state.nextExchangeNumber + 1,
    },
    record,
  }
}
