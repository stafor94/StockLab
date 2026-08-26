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
- Corporate-action metadata may retain an earlier announcement/declaration date for audit purposes, but the accounting event is not revealed before its event timing.

## Account processing order

When advancing time:

1. due stock-sale settlements become settled cash;
2. corporate actions revealed by the destination date are applied;
3. WS Bank daily loan accrual/billing/retry is processed;
4. the new game day opens in `preopen` state.

## Portfolio effects

### Dividend

A dividend payload records `declarationDate`, `exDate`, `recordDate`, `paymentDate`, `cashPerShare`, currency, and the applicable withholding rate. The corporate event's `date` is the actual payment date and must equal `paymentDate`; the event posts at `PRE_OPEN` on that date.

Entitlement is not calculated from the position held on payment day. The pure corporate-action engine reconstructs the share quantity held immediately before the ex-dividend date by replaying persisted executed trades and quantity-changing corporate actions. Therefore:

- shares sold after the ex-dividend date remain entitled;
- shares bought on or after the ex-dividend date do not receive that dividend;
- splits/reverse splits and share mergers before the ex-dividend date are reflected in the entitlement quantity;
- the dividend changes cash only and never rewrites OHLC.

This uses the existing persisted trade history, so no save-schema change is required.

For U.S. portfolio dividends in the current dataset, StockLab applies the 15% U.S.-Korea treaty portfolio-dividend withholding rate through event data rather than a UI constant.

### Split / reverse split

Share quantity changes by the event ratio and average cost changes inversely so book value is preserved. StockLab remains whole-share only. Fractional entitlements require an authoritative `cashInLieuPrice`; otherwise processing fails rather than discarding value.

Historical price-scale restoration is a separate ingestion concern. When Nasdaq Historical Quotes is split-adjusted, the U.S. builder restores pre-event OHLC/volume to the historical unadjusted scale using a verified dated ratio. The split event is still emitted separately so gameplay holdings change on the effective date.

The U.S. corporate-event split rows must stay exactly synchronized with `scripts/data/us-split-events.ts`; static validation fails for a missing, duplicated, or extra U.S. split relative to the raw-price restoration table.

### Halt / resume

A halt marks the asset non-tradable and cancels pending orders. A resume removes the halt. The order store enforces both halt and delisting restrictions before accepting a new order.

### Delisting

A delisted asset becomes non-tradable. If the event has an authoritative cash-out price, held shares are removed and cash is credited. Without a cash-out price, StockLab does not invent a value or silently delete the position.

### Merger

Cash consideration and/or share conversion can be represented. Fractional target entitlements require an authoritative cash-in-lieu price.

### Listing

For assets that enter the StockLab universe after the 2018 coverage start, a `LISTING` event is stored on the first tradable date recorded in the authoritative market-data manifest. Static validation requires one and only one listing event for each such asset and requires the event date to equal `manifest.json` `listedFrom`.

## Current curated coverage

`public/data/events/corporate.json` declares one of three source modes:

- `empty-seed`: no verified event data loaded;
- `curated-partial`: all committed events are source-backed, but the set is explicitly incomplete;
- `generated`: configured event coverage is considered comprehensive.

The dataset remains **`curated-partial`**. This expansion does not claim full corporate-action completeness across all 109 assets.

Included in the current curated set:

- the verified K001 2018 split/halt/resumption sequence;
- all 11 verified U.S. split events required by the Nasdaq historical-unadjusted price restoration policy, unchanged and de-duplicated;
- one listing event for each of the 12 assets whose authoritative market history begins after the common 2018-01-02 coverage start (7 Korean stocks and 5 U.S. stocks);
- the full set of U005 quarterly cash dividends whose payment dates fall within StockLab coverage from 2018 through 2026-06, with declaration/ex/record/payment dates from issuer investor relations.

All 109 catalog assets are checked by the corporate-event validator for valid IDs and listing-start consistency. That catalog-wide check is not equivalent to a claim that every dividend, merger, halt, resume, or delisting has already been researched and encoded.

Known omissions that keep the dataset `curated-partial`:

- dividends/distributions for the other 108 assets, including ETF distributions;
- exhaustive merger/acquisition consideration events;
- exhaustive delisting/trading-termination events;
- exhaustive long-duration trading halts and resumptions;
- corporate actions whose primary-source terms are not yet sufficiently verified for production use.

A dividend declared before the coverage endpoint but payable after it is not emitted early merely because its future payment is already known. Fake events must never be added merely to populate the UI.

## Validation

`npm run data:events:check` verifies at least:

- event ID uniqueness through schema parsing;
- known 109-asset catalog IDs;
- valid ISO calendar dates and dataset date range;
- type-specific payload constraints and positive ratios/consideration values;
- accidental asset/date/type duplicates;
- HTTPS source metadata and rejection of known third-party price/aggregator authorities;
- stored event sort order;
- listing date consistency with the market-data manifest;
- exact U.S. split synchronization with the Nasdaq split-restoration table.

Runtime regression tests cover dividend entitlement/payment, split holdings and average cost, halt order cancellation, delisting cash settlement, and next-day reveal of post-close events. Order placement separately rejects halted and delisted assets.

## Source policy

- Korean corporate actions: official KRX/KIND/DART disclosure or issuer investor-relations material.
- U.S. split/reverse-split history used by the price-restoration pipeline: Nasdaq plus issuer-verified dated split history.
- Other U.S. corporate actions: authoritative issuer investor relations, exchange records, SEC/regulatory records, or similarly primary evidence appropriate to the event.
- U.S. treaty dividend withholding policy: official U.S. tax-treaty material.
- Third-party price feeds and aggregators are not corporate-action authority and are never used to replace KRX/Nasdaq execution-price data.

Every event retains source metadata so future corrections can be audited. Corporate-action data never rewrites historical execution OHLC.
