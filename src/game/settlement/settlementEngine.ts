import type { PendingSettlement } from '../trading/types'
import { roundCurrency } from '../trading/wsBroker'

interface SettlementCashState {
  krwCash: number
  usdCash: number
  pendingSettlements: PendingSettlement[]
}

export interface SettlementResult extends SettlementCashState {
  settled: PendingSettlement[]
}

export function applyDueSettlements(
  state: SettlementCashState,
  targetDate: string,
): SettlementResult {
  const settled = state.pendingSettlements.filter((item) => item.settlementDate <= targetDate)
  const pendingSettlements = state.pendingSettlements.filter((item) => item.settlementDate > targetDate)

  let krwCash = state.krwCash
  let usdCash = state.usdCash
  for (const item of settled) {
    if (item.currency === 'KRW') krwCash = roundCurrency(krwCash + item.amount, 'KRW')
    else usdCash = roundCurrency(usdCash + item.amount, 'USD')
  }

  return { krwCash, usdCash, pendingSettlements, settled }
}
