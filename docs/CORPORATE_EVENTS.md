# Corporate Events

StockLab treats corporate actions as dated events that are separate from raw execution-price OHLC.

## Scope

Supported event types:

- `DIVIDEND`
- `SPLIT`
- `REVERSE_SPLIT`
- `MERGER`
- `DELISTING`
- `LISTING`
- `HALT`
- `RESUME`

Each event carries an opaque game `assetId`, a historical date, timing (`PRE_OPEN`, `INTRADAY`, or `POST_CLOSE`), a masked title/summary, payload, and source metadata.

## No-lookahead timing

- `PRE_OPEN` events become visible and effective when the game enters that date.
- `INTRADAY` and `POST_CLOSE` events are not exposed during that date's pre-open decision phase. They become visible/effective on the next gameplay date.
- Important events stop multi-day progression at their reveal date and must be acknowledged before time can continue.
- Dividends default to non-blocking; listing, halt/resume, split/reverse split, merger, and delisting default to important. A curated dataset may override the flag.

## Account processing order

When advancing time:

1. due stock-sale settlements become settled cash;
2. corporate actions revealed by the destination date are applied;
3. WS Bank daily loan accrual/billing/retry is processed;
4. the new game day opens in `preopen` state.

This means authoritative cash distributions credited pre-open can be used by the WS Bank debit later in the same game-date transition. Unsettled sale proceeds still cannot be used.

## Portfolio effects

### Dividend

The event provides `cashPerShare`, currency, and the applicable withholding rate. The engine credits only the net amount for shares held when the event is processed. Tax rates are event data, not hard-coded into the UI.

### Split / reverse split

Share quantity changes by the event ratio and average cost changes inversely so book value is preserved. StockLab remains whole-share only. If a split produces a fractional entitlement, the event must provide an authoritative `cashInLieuPrice`; otherwise validation/processing fails rather than silently discarding value.

### Halt / resume

A halt marks the asset non-tradable and cancels pending orders. A resume removes the halt. The order screen and store both enforce the restriction.

### Delisting

A delisted asset becomes non-tradable. If the event has an authoritative cash-out price, held shares are removed and cash is credited. Without a cash-out price, StockLab does not invent a value or silently delete the position.

### Merger

Cash consideration and/or share conversion can be represented. Share conversions require the masked target asset metadata and ratio. Fractional target entitlements require an authoritative cash-in-lieu price.

## Data policy

`public/data/events/corporate.json` is intentionally committed as an empty, schema-valid seed until authoritative corporate-event history is built. Fake dividends, splits, mergers, halts, or delistings must never be added to make the UI look populated.

Korean corporate-action facts should be sourced from official KRX/disclosure material. U.S. corporate actions should use Alpha Vantage event fields where appropriate for the project's U.S. market-data policy, supplemented by authoritative issuer/regulatory records when Alpha Vantage does not cover events such as mergers, halts, or delistings. Raw OHLC used for execution remains unadjusted regardless of event source.

Every generated/curated event must retain source metadata so future corrections can be audited.
