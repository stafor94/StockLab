import type { MarketCode } from '../../types/market'
import type { TradingAccountState } from './types'

export function closeMarketSession(source: TradingAccountState, market: MarketCode, tradingDate: string): TradingAccountState {
  const session = source.marketSessions[market]
  if (session.phase === 'preopen' || session.tradingDate !== tradingDate) {
    throw new Error('해당 시장이 시작되기 전에는 마감할 수 없습니다.')
  }
  if (session.phase === 'closed') return source
  return {
    ...source,
    marketSessions: {
      KR: { ...source.marketSessions.KR },
      US: { ...source.marketSessions.US },
      [market]: { phase: 'closed', tradingDate },
    },
  }
}
