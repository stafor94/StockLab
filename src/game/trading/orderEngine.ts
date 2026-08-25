import type { AssetCurrency } from '../../types/market'
import {
  calculateBuyCashRequired,
  calculateSellProceeds,
} from './wsBroker'
import type {
  MarketOpenExecutionContext,
  MarketOrder,
  OrderExecutionResult,
  Position,
  QueueOrderInput,
  TradingAccountState,
  TradeExecution,
} from './types'

function cashForCurrency(state: TradingAccountState, currency: AssetCurrency): number {
  return currency === 'KRW' ? state.krwCash : state.usdCash
}

function setCashForCurrency(
  state: TradingAccountState,
  currency: AssetCurrency,
  cash: number,
): void {
  if (currency === 'KRW') state.krwCash = cash
  else state.usdCash = cash
}

function positionFor(state: TradingAccountState, assetId: string): Position | undefined {
  return state.positions.find((position) => position.assetId === assetId)
}

function reservedSellQuantity(state: TradingAccountState, assetId: string): number {
  const position = positionFor(state, assetId)
  if (!position) return 0
  const sells = state.pendingOrders.filter((order) => order.assetId === assetId && order.kind.startsWith('sell-'))
  if (sells.some((order) => order.kind === 'sell-all')) return position.quantity
  return sells.reduce((total, order) => total + (order.requestedQuantity ?? 0), 0)
}

export function validateOrderPlacement(
  state: TradingAccountState,
  input: QueueOrderInput,
): string | null {
  if (state.marketSessionPhase !== 'preopen') return '이미 장이 시작되어 오늘 주문을 추가할 수 없습니다.'

  if (input.kind === 'buy-amount') {
    const amount = input.requestedAmount ?? 0
    if (!Number.isFinite(amount) || amount <= 0) return '매수 금액은 0보다 커야 합니다.'
    if (amount > cashForCurrency(state, input.currency)) return '현재 결제 완료 현금보다 큰 금액은 주문할 수 없습니다.'
    return null
  }

  if (input.kind === 'buy-quantity') {
    const quantity = input.requestedQuantity ?? 0
    if (!Number.isInteger(quantity) || quantity <= 0) return '매수 수량은 1주 이상의 정수여야 합니다.'
    if (cashForCurrency(state, input.currency) <= 0) return '매수에 사용할 결제 완료 현금이 없습니다.'
    return null
  }

  const position = positionFor(state, input.assetId)
  if (!position || position.quantity <= 0) return '보유 수량이 없습니다.'
  const available = position.quantity - reservedSellQuantity(state, input.assetId)
  if (input.kind === 'sell-all') {
    if (available !== position.quantity) return '이미 이 종목에 매도 주문이 있어 전량매도를 추가할 수 없습니다.'
    return null
  }

  const quantity = input.requestedQuantity ?? 0
  if (!Number.isInteger(quantity) || quantity <= 0) return '매도 수량은 1주 이상의 정수여야 합니다.'
  if (quantity > available) return '미체결 매도 주문을 제외한 보유 수량을 초과했습니다.'
  return null
}

function cloneState(state: TradingAccountState): TradingAccountState {
  return {
    ...state,
    positions: state.positions.map((item) => ({ ...item })),
    pendingOrders: state.pendingOrders.map((item) => ({ ...item })),
    pendingSettlements: state.pendingSettlements.map((item) => ({ ...item })),
    trades: state.trades.map((item) => ({ ...item })),
  }
}

function updateBoughtPosition(
  state: TradingAccountState,
  order: MarketOrder,
  quantity: number,
  price: number,
): void {
  const existing = positionFor(state, order.assetId)
  if (!existing) {
    state.positions.push({
      assetId: order.assetId,
      market: order.market,
      currency: order.currency,
      quantity,
      averagePrice: price,
    })
    return
  }

  const newQuantity = existing.quantity + quantity
  existing.averagePrice = ((existing.averagePrice * existing.quantity) + (price * quantity)) / newQuantity
  existing.quantity = newQuantity
}

function reducePosition(state: TradingAccountState, assetId: string, quantity: number): void {
  const position = positionFor(state, assetId)
  if (!position) return
  position.quantity -= quantity
  if (position.quantity <= 0) {
    state.positions = state.positions.filter((item) => item.assetId !== assetId)
  }
}

function maxAffordableQuantity(
  budget: number,
  openPrice: number,
  order: MarketOrder,
): number {
  let quantity = Math.floor(budget / openPrice)
  while (quantity > 0) {
    const { total } = calculateBuyCashRequired(quantity, openPrice, order.market, order.currency)
    if (total <= budget) return quantity
    quantity -= 1
  }
  return 0
}

export function executeMarketOpenOrders(
  source: TradingAccountState,
  context: MarketOpenExecutionContext,
): { state: TradingAccountState; results: OrderExecutionResult[] } {
  const state = cloneState(source)
  const results: OrderExecutionResult[] = []
  const orders = [...state.pendingOrders]
  state.pendingOrders = []

  for (const order of orders) {
    if (order.tradeDate !== context.date) {
      results.push({ orderId: order.id, status: 'cancelled', reason: 'wrong-trade-date' })
      continue
    }

    const openPrice = context.openPrices[order.assetId]
    if (!openPrice || !Number.isFinite(openPrice) || openPrice <= 0) {
      results.push({ orderId: order.id, status: 'cancelled', reason: 'missing-open-price' })
      continue
    }

    if (order.kind === 'buy-amount' || order.kind === 'buy-quantity') {
      const availableCash = cashForCurrency(state, order.currency)
      const quantity = order.kind === 'buy-amount'
        ? maxAffordableQuantity(Math.min(order.requestedAmount ?? 0, availableCash), openPrice, order)
        : order.requestedQuantity ?? 0
      if (quantity <= 0 || !Number.isInteger(quantity)) {
        results.push({ orderId: order.id, status: 'cancelled', reason: 'invalid-order' })
        continue
      }
      const cost = calculateBuyCashRequired(quantity, openPrice, order.market, order.currency)
      if (cost.total > availableCash) {
        results.push({ orderId: order.id, status: 'cancelled', reason: 'insufficient-cash' })
        continue
      }

      setCashForCurrency(state, order.currency, availableCash - cost.total)
      updateBoughtPosition(state, order, quantity, openPrice)
      const trade: TradeExecution = {
        orderId: order.id,
        assetId: order.assetId,
        market: order.market,
        currency: order.currency,
        side: 'buy',
        quantity,
        price: openPrice,
        grossAmount: cost.grossAmount,
        commission: cost.commission,
        cashAmount: cost.total,
        executedDate: context.date,
        settlementDate: null,
      }
      state.trades.push(trade)
      results.push({ orderId: order.id, status: 'filled', trade })
      continue
    }

    const position = positionFor(state, order.assetId)
    const quantity = order.kind === 'sell-all' ? position?.quantity ?? 0 : order.requestedQuantity ?? 0
    if (!position || quantity <= 0 || quantity > position.quantity) {
      results.push({ orderId: order.id, status: 'cancelled', reason: 'insufficient-position' })
      continue
    }
    const settlementDate = context.settlementDates[order.assetId]
    if (!settlementDate) {
      results.push({ orderId: order.id, status: 'cancelled', reason: 'missing-settlement-date' })
      continue
    }

    const proceeds = calculateSellProceeds(quantity, openPrice, order.market, order.currency)
    reducePosition(state, order.assetId, quantity)
    state.pendingSettlements.push({
      id: `S-${order.id}`,
      orderId: order.id,
      assetId: order.assetId,
      market: order.market,
      currency: order.currency,
      amount: proceeds.net,
      tradeDate: context.date,
      settlementDate,
    })
    const trade: TradeExecution = {
      orderId: order.id,
      assetId: order.assetId,
      market: order.market,
      currency: order.currency,
      side: 'sell',
      quantity,
      price: openPrice,
      grossAmount: proceeds.grossAmount,
      commission: proceeds.commission,
      cashAmount: proceeds.net,
      executedDate: context.date,
      settlementDate,
    }
    state.trades.push(trade)
    results.push({ orderId: order.id, status: 'filled', trade })
  }

  state.marketSessionPhase = 'opened'
  return { state, results }
}
