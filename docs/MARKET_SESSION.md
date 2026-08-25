# Market session lifecycle

StockLab models each playable trading date as a deterministic three-phase state machine. The phase is persisted in the save so refreshes cannot accidentally reveal information or re-run executions.

## Phases

1. `preopen`
   - Orders may be queued or cancelled.
   - The current day's open/high/low/close are hidden.
   - Portfolio valuation uses the latest previous close.
2. `opened`
   - All queued market orders for that date have been processed once at the actual unadjusted open.
   - The current day's open is visible.
   - High, low, and close remain hidden.
   - New orders are blocked.
3. `closed`
   - The current day's full unadjusted OHLC bar is visible.
   - Portfolio valuation switches to the current close.
   - The player may advance to another game date.

A date that is closed for both supported markets has no session requirement and can be advanced directly.

## Order execution

Opening a session is valid even when there are zero queued orders. This keeps the phase lifecycle independent from whether the player traded that day.

When orders exist, the open action loads only the data required for those orders, resolves the same-day raw open price, calculates sell settlement dates, executes the queue once, and then transitions the account to `opened`.

The open action is idempotently guarded by the store: once the phase is no longer `preopen`, the order queue cannot execute again for that date.

## Information boundary

The committed daily JSON contains complete historical bars, so runtime selectors must enforce the information boundary rather than trusting UI rendering alone.

- `preopen`: bars with `date < gameDate` only.
- `opened`: full bars with `date < gameDate` only; the current `open` may be shown separately.
- `closed`: full bars with `date <= gameDate`.

The same rule is used by the candlestick chart and portfolio valuation so there is no mismatch between visible prices and account performance.

## Timeline and autoplay

A trading date cannot advance while its phase is `preopen` or `opened`. Manual time controls therefore require the current trading date to be closed first.

Autoplay uses the exact same state transitions:

```text
holiday/non-trading date -> advance date
trading date preopen     -> open session / execute queued orders
trading date opened      -> close session / reveal OHLC
trading date closed      -> advance date
```

Autoplay remains UI timing only. Important corporate events, important news, WS Bank payment failures, and game-over conditions still stop deterministic date advancement.

## Save compatibility

`v0.13.0` advances the save schema to v9 because `marketSessionPhase` gains the persisted `closed` value. Older saves migrate automatically; existing `preopen` and `opened` values are preserved, and invalid or missing legacy values fall back to `preopen`.
