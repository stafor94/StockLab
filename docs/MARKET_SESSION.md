# Market session lifecycle

StockLab models each playable trading date as a deterministic three-phase state machine. The phase is persisted in the save so refreshes cannot accidentally reveal information or re-run executions.

## Phases

1. `preopen`
   - The current day's open/high/low/close are hidden.
   - Portfolio valuation uses the latest previous close.
   - New UI orders are not accepted because the day's execution price has not been revealed yet.
2. `opened`
   - The current day's actual raw/unadjusted open is visible.
   - High, low, and close remain hidden.
   - New buy and sell orders execute immediately at that same open price until the session is closed.
3. `closed`
   - The current day's full raw/unadjusted OHLC bar is visible.
   - Portfolio valuation switches to the current close.
   - New buy and sell orders execute immediately at that same close price until the player advances to another game date.
   - The player may advance to another game date at any time after the close-price window is revealed.

A date that is closed for both supported markets has no session requirement and can be advanced directly.

## Order execution

The normal player flow is:

```text
preopen -> start market -> reveal actual open -> trade at open -> close market -> reveal full OHLC/actual close -> trade at close -> advance date
```

Starting a session is valid even when the player has no orders. The open action resolves the current date's authoritative raw/unadjusted open prices and transitions the account to `opened`. While `opened`, each new order uses the already revealed open price as its deterministic execution price. Closing the session reveals the full OHLC bar and transitions the account to `closed`; while `closed`, each new order uses the already revealed raw/unadjusted close as its deterministic execution price.

Buy previews use the same pure broker calculation as execution, including WS Securities commission, so a quantity such as 100 shares shows its gross amount, commission, and exact total cash requirement before submission. Sell previews use the same historical-cost engine as execution and show expected net settlement proceeds. Open-price and close-price executions share this calculation path; only the phase-authorized execution price differs.

For backward compatibility, older saves may still contain pending pre-open orders created by StockLab versions before v0.20.0. Those legacy orders are processed once at the actual open when the session starts, then cleared normally. New UI orders are not queued during `preopen`.

The open transition is guarded by the store: once the phase is no longer `preopen`, the legacy pending-order queue cannot execute again for that date. Opened- and closed-session orders are separate immediate executions with deterministic order IDs and normal settlement handling. The pure trading engine validates that an `opened` session can execute only at the open and a `closed` session can execute only at the close.

## Information boundary

The committed daily JSON contains complete historical bars, so runtime selectors must enforce the information boundary rather than trusting UI rendering alone.

- `preopen`: bars with `date < gameDate` only.
- `opened`: full bars with `date < gameDate` only; the current `open` may be shown separately and used for execution.
- `closed`: full bars with `date <= gameDate`; the current close may be used for execution only after the full bar is revealed.

The same rule is used by the candlestick chart and portfolio valuation so there is no mismatch between visible prices and account performance. Opening the market never reveals the current day's high, low, or close.

## Timeline and autoplay

A trading date cannot advance while its phase is `preopen` or `opened`. Manual time controls therefore require the current trading date to be closed first. Once `closed`, close-price trading is optional and the player may either trade at the revealed close or advance immediately.

Autoplay uses the exact same state transitions but does not invent or submit trades for the player:

```text
holiday/non-trading date -> advance date
trading date preopen     -> open session / reveal open
trading date opened      -> close session / reveal OHLC and close-price window
trading date closed      -> advance date
```

Autoplay remains UI timing only. Important corporate events, important news, WS Bank payment failures, and game-over conditions still stop deterministic date advancement.

## Save compatibility

`v0.13.0` advanced the save schema to v9 because `marketSessionPhase` gained the persisted `closed` value. `v0.22.0` changes only how the existing `opened` and `closed` phases authorize immediate execution and does not add persisted fields. The current save schema remains v11, existing saves remain compatible, and legacy pending pre-open orders are still honored once at market open instead of being discarded or rewritten.
