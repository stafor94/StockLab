import type { TradingAccountState } from './types'

export function closeMarketSession(source: TradingAccountState): TradingAccountState {
  if (source.marketSessionPhase === 'preopen') {
    throw new Error('장 시작 전에는 마감할 수 없습니다.')
  }
  if (source.marketSessionPhase === 'closed') {
    return source
  }
  return {
    ...source,
    marketSessionPhase: 'closed',
  }
}

export function canAdvanceFromSession(isTradingDate: boolean, phase: TradingAccountState['marketSessionPhase']): boolean {
  return !isTradingDate || phase === 'closed'
}
