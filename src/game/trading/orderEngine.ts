import type { AssetCurrency, MarketCode } from '../../types/market'
import {
  calculateBuyCashRequired,
  calculateMaxAffordableQuantity,
  calculateSellProceeds,
  roundCurrency,
} from './wsBroker'
import type {
  MarketOpenExecutionContext,
  MarketOrder,
  MarketSessionExecutionPrice,
  MarketSessionPriceExecutionContext,
  OrderExecutionResult,
  Position,
  QueueOrderInput,
  TradingAccountState,
  TradeExecution,
} from './types'

function cashForCurrency(state: TradingAccountState, currency: AssetCurrency): number {
  return currency === 'KRW' ? state.krwCash : state.usdCash
}

function setCashForCurrency(state: TradingAccountState, currency: AssetCurrency, cash: number): void {
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

export function validateOrderPlacement(state: TradingAccountState, input: QueueOrderInput): string | null {
  if (state.marketSessions[input.market].phase !== 'preopen') return '현재 해당 시장은 개장 전 예약 주문을 받을 수 있는 상태가 아닙니다.'
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

function expectedSessionPriceSource(state: TradingAccountState, market: MarketCode): MarketSessionExecutionPrice | null {
  return state.marketSessions[market].phase === 'opened' ? 'open' : null
}

function priceLabel(source: MarketSessionExecutionPrice): string {
  return source === 'open' ? '시가' : '종가'
}

export function validateSessionPriceOrderPlacement(
  state: TradingAccountState,
  input: QueueOrderInput,
  executionPrice: number,
  priceSource: MarketSessionExecutionPrice,
): string | null {
  const expectedSource = expectedSessionPriceSource(state, input.market)
  if (!expectedSource) return '해당 시장이 열린 상태에서만 주문할 수 있습니다.'
  if (expectedSource !== priceSource) return `현재 세션에서는 ${priceLabel(expectedSource)} 주문만 체결할 수 있습니다.`
  if (!Number.isFinite(executionPrice) || executionPrice <= 0) return `오늘 ${priceLabel(priceSource)}를 확인할 수 없어 주문할 수 없습니다.`

  if (input.kind === 'buy-amount') {
    const amount = input.requestedAmount ?? 0
    if (!Number.isFinite(amount) || amount <= 0) return '매수 금액은 0보다 커야 합니다.'
    if (amount > cashForCurrency(state, input.currency)) return '현재 결제 완료 현금보다 큰 금액은 주문할 수 없습니다.'
    if (calculateMaxAffordableQuantity(amount, executionPrice, input.market, input.currency) <= 0) return '입력한 금액으로 1주 이상 살 수 없습니다.'
    return null
  }

  if (input.kind === 'buy-quantity') {
    const quantity = input.requestedQuantity ?? 0
    if (!Number.isInteger(quantity) || quantity <= 0) return '매수 수량은 1주 이상의 정수여야 합니다.'
    const cost = calculateBuyCashRequired(quantity, executionPrice, input.market, input.currency)
    if (cost.total > cashForCurrency(state, input.currency)) return '수수료를 포함한 총 필요 금액이 현재 현금을 초과합니다.'
    return null
  }

  const position = positionFor(state, input.assetId)
  if (!position || position.quantity <= 0) return '보유 수량이 없습니다.'
  if (input.kind === 'sell-all') return null

  const quantity = input.requestedQuantity ?? 0
  if (!Number.isInteger(quantity) || quantity <= 0) return '매도 수량은 1주 이상의 정수여야 합니다.'
  if (quantity > position.quantity) return '보유 수량을 초과해 매도할 수 없습니다.'
  return null
}

function cloneState(state: TradingAccountState): TradingAccountState {
  return {
    ...state,
    marketSessions: {
      KR: { ...state.marketSessions.KR },
      US: { ...state.marketSessions.US },
    },
    positions: state.positions.map((item) => ({ ...item })),
    pendingOrders: state.pendingOrders.map((item) => ({ ...item })),
    pendingSettlements: state.pendingSettlements.map((item) => ({ ...item })),
    trades: state.trades.map((item) => ({ ...item })),
  }
}

function updateBoughtPosition(state: TradingAccountState, order: MarketOrder, quantity: number, price: number): void {
  const existing = positionFor(state, order.assetId)
  if (!existing) {
    state.positions.push({ assetId: order.assetId, market: order.market, currency: order.currency, quantity, averagePrice: price })
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
  if (position.quantity <= 0) state.positions = state.positions.filter((item) => item.assetId !== assetId)
}

function executeOrderAtPrice(
  state: TradingAccountState,
  order: MarketOrder,
  date: string,
  executionPrice: number,
  settlementDate?: string,
): OrderExecutionResult {
  if (order.tradeDate !== date) return { orderId: order.id, status: 'cancelled', reason: 'wrong-trade-date' }

  if (order.kind === 'buy-amount' || order.kind === 'buy-quantity') {
    const availableCash = cashForCurrency(state, order.currency)
    const quantity = order.kind === 'buy-amount'
      ? calculateMaxAffordableQuantity(Math.min(order.requestedAmount ?? 0, availableCash), executionPrice, order.market, order.currency)
      : order.requestedQuantity ?? 0
    if (quantity <= 0 || !Number.isInteger(quantity)) return { orderId: order.id, status: 'cancelled', reason: 'invalid-order' }
    const cost = calculateBuyCashRequired(quantity, executionPrice, order.market, order.currency)
    if (cost.total > availableCash) return { orderId: order.id, status: 'cancelled', reason: 'insufficient-cash' }
    setCashForCurrency(state, order.currency, availableCash - cost.total)
    updateBoughtPosition(state, order, quantity, executionPrice)
    const trade: TradeExecution = {
      orderId: order.id, assetId: order.assetId, market: order.market, currency: order.currency, side: 'buy', quantity,
      price: executionPrice, grossAmount: cost.grossAmount, commission: cost.commission, transactionTax: 0, ruralSpecialTax: 0,
      secSection31Fee: 0, finraTaf: 0, totalFees: cost.commission, cashAmount: cost.total,
      costBasis: null, realizedPnl: null, executedDate: date, settlementDate: null,
    }
    state.trades.push(trade)
    return { orderId: order.id, status: 'filled', trade }
  }

  const position = positionFor(state, order.assetId)
  const quantity = order.kind === 'sell-all' ? position?.quantity ?? 0 : order.requestedQuantity ?? 0
  if (!position || quantity <= 0 || quantity > position.quantity) return { orderId: order.id, status: 'cancelled', reason: 'insufficient-position' }
  if (!settlementDate) return { orderId: order.id, status: 'cancelled', reason: 'missing-settlement-date' }

  const proceeds = calculateSellProceeds(quantity, executionPrice, order.assetId, order.market, order.currency, date)
  const costBasis = position.averagePrice * quantity
  const realizedPnl = roundCurrency(proceeds.net - costBasis, order.currency)
  reducePosition(state, order.assetId, quantity)
  state.pendingSettlements.push({ id: `S-${order.id}`, orderId: order.id, assetId: order.assetId, market: order.market, currency: order.currency, amount: proceeds.net, tradeDate: date, settlementDate })
  const trade: TradeExecution = {
    orderId: order.id, assetId: order.assetId, market: order.market, currency: order.currency, side: 'sell', quantity,
    price: executionPrice, grossAmount: proceeds.grossAmount, commission: proceeds.commission, transactionTax: proceeds.transactionTax,
    ruralSpecialTax: proceeds.ruralSpecialTax, secSection31Fee: proceeds.secSection31Fee, finraTaf: proceeds.finraTaf,
    totalFees: proceeds.totalFees, cashAmount: proceeds.net, costBasis, realizedPnl, executedDate: date, settlementDate,
  }
  state.trades.push(trade)
  return { orderId: order.id, status: 'filled', trade }
}

function executeOrderAtOpen(
  state: TradingAccountState,
  order: MarketOrder,
  context: MarketOpenExecutionContext,
): OrderExecutionResult {
  if (order.tradeDate !== context.date) return { orderId: order.id, status: 'cancelled', reason: 'wrong-trade-date' }
  const openPrice = context.openPrices[order.assetId]
  if (!openPrice || !Number.isFinite(openPrice) || openPrice <= 0) return { orderId: order.id, status: 'cancelled', reason: 'missing-open-price' }
  return executeOrderAtPrice(state, order, context.date, openPrice, context.settlementDates[order.assetId])
}

export function executeMarketOpenOrders(source: TradingAccountState, context: MarketOpenExecutionContext): { state: TradingAccountState; results: OrderExecutionResult[] } {
  const state = cloneState(source)
  const results: OrderExecutionResult[] = []
  const orders = state.pendingOrders.filter((order) => order.market === context.market)
  state.pendingOrders = state.pendingOrders.filter((order) => order.market !== context.market)

  for (const order of orders) results.push(executeOrderAtOpen(state, order, context))
  state.marketSessions[context.market] = { phase: 'opened', tradingDate: context.date }
  return { state, results }
}

export function executeSessionPriceOrder(
  source: TradingAccountState,
  order: MarketOrder,
  context: MarketSessionPriceExecutionContext,
): { state: TradingAccountState; result: OrderExecutionResult } {
  const state = cloneState(source)
  const expectedSource = expectedSessionPriceSource(state, order.market)
  if (!expectedSource || expectedSource !== context.priceSource || !Number.isFinite(context.price) || context.price <= 0) {
    return { state, result: { orderId: order.id, status: 'cancelled', reason: 'invalid-order' } }
  }
  const result = executeOrderAtPrice(state, order, context.date, context.price, context.settlementDate)
  return { state, result }
}
