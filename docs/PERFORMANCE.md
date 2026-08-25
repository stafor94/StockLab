# Portfolio performance and ranks

## Purpose
StockLab starts with KRW 10,000,000 financed entirely by the WS Bank loan. Because starting net worth is zero, ordinary equity-return percentages are undefined. The game therefore keeps **strategy return** and **net worth** as separate metrics.

## Strategy return

```text
strategy capital = current gross assets + cumulative loan principal repaid
strategy return = strategy capital / 10,000,000 - 1
```

Adding cumulative principal repayment prevents an early repayment from being misclassified as an investment loss. Interest, taxes, commissions, FX spread and other expenses are not added back, so they reduce strategy return naturally.

## Net worth

```text
net worth = gross assets - remaining loan principal - accrued/past-due loan interest
```

Net worth begins at zero and is shown as an absolute KRW amount rather than a percentage.

## Valuation information boundary
- PRE_OPEN: use the latest known close strictly before the game date.
- OPENED: today's actual open may be used because the order-execution phase has already revealed it.
- Today's high, low and close are never used before the game has reached a future phase that makes them public.
- USD assets use the latest Bank of Korea USD/KRW reference rate available for the game date.
- If an authoritative price or required FX rate is missing, total valuation is marked incomplete rather than fabricated.

## Realized and unrealized P&L
Unrealized P&L compares the known valuation price with the position's average execution price. Starting with v0.11.0, sell executions persist the position cost basis that existed immediately before the sale and the realized P&L after sell-side commissions/taxes/regulatory fees. Legacy sells are kept intact and marked as having unavailable realized cost basis; they are never retroactively guessed.

Buy-side commission is reflected in actual cash and therefore in strategy return. Position-level P&L remains an execution-price comparison for clarity.

## Return badges
- below -30%: 회복 모드
- -30% to below 0%: 시장 견습생
- 0% to below 10%: 초보 투자자
- 10% to below 25%: 성장 투자자
- 25% to below 50%: 숙련 투자자
- 50% to below 100%: 큰손
- 100% to below 200%: 시장의 고수
- 200% or higher: 월가의 전설

The badge is derived from the current strategy return and does not require a separate persisted state.
