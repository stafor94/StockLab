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

Each event carries an opaque game `assetId`, historical date, timing (`PRE_OPEN`, `INTRADAY`, or `POST_CLOSE`), masked title/summary, payload, and source metadata.

## No-lookahead timing

- `PRE_OPEN` events become visible and effective when the game enters that date.
- `INTRADAY` and `POST_CLOSE` events are not exposed during that date's pre-open decision phase; they become visible/effective on the next gameplay date.
- Important events stop multi-day progression at their reveal date and must be acknowledged before time continues.

## Account processing order

When advancing time:

1. due stock-sale settlements become settled cash;
2. corporate actions revealed by the destination date are applied;
3. WS Bank daily loan accrual/billing/retry is processed;
4. the new game day opens in `preopen` state.

## Portfolio effects

### Dividend

The event provides `cashPerShare`, currency, and applicable withholding rate. Tax rates are event data, not UI constants.

### Split / reverse split

Share quantity changes by the event ratio and average cost changes inversely so book value is preserved. StockLab remains whole-share only. Fractional entitlements require an authoritative `cashInLieuPrice`; otherwise processing fails rather than discarding value.

Historical price-scale restoration is a separate ingestion concern. When Nasdaq Historical Quotes is split-adjusted, the U.S. builder restores pre-event OHLC/volume to the historical unadjusted scale using a verified dated ratio. The split event is still emitted separately so gameplay holdings change on the effective date.

The current U.S. catalog has 11 verified split events across 9 assets. Regression coverage includes AAPL 2020, TSLA 2020/2022, NVDA 2021/2024, AMZN 2022, and GOOG/GOOGL 2022 split cases.

### Halt / resume

A halt marks the asset non-tradable and cancels pending orders. A resume removes the halt. The order screen and store both enforce the restriction.

### Delisting

A delisted asset becomes non-tradable. If the event has an authoritative cash-out price, held shares are removed and cash is credited. Without a cash-out price, StockLab does not invent a value or silently delete the position.

### Merger

Cash consideration and/or share conversion can be represented. Fractional target entitlements require an authoritative cash-in-lieu price.

## Data completeness

`public/data/events/corporate.json` declares one of three source modes:

- `empty-seed`: no verified event data loaded;
- `curated-partial`: all committed events are source-backed, but the set is explicitly incomplete;
- `generated`: configured event coverage is considered comprehensive.

The current dataset remains `curated-partial`. It includes the verified K001 2018 split/halt/resumption sequence plus verified U.S. split events needed by the Nasdaq raw-price policy. This does not imply complete dividend, merger, halt, listing, or delisting coverage for all 109 assets.

Fake events must never be added merely to populate the UI.

## Source policy

- Korean corporate actions: official KRX/disclosure or issuer investor-relations material.
- U.S. split/reverse-split history used by the price-restoration pipeline: Nasdaq/issuer-verified dated split history.
- Other U.S. corporate actions: authoritative issuer, exchange, SEC/regulatory, or similarly primary records appropriate to the event.
- Third-party price feeds are not corporate-action authority and are never used to replace KRX/Nasdaq execution-price data.

Every event retains source metadata so future corrections can be audited. Static validation rejects unknown game asset IDs, events outside declared coverage, and non-HTTPS source references.
