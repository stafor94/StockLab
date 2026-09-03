# Market session lifecycle

StockLab has one chronological game clock, while KRX and U.S. regular sessions keep independent trading dates and session state. Market progression is determined by the next actual market event rather than one shared global `장 시작 / 장 마감` phase.

## Market events

The deterministic timeline supports four regular-session events:

- `KR OPEN`: KRX 09:00 Asia/Seoul
- `KR CLOSE`: KRX 15:30 Asia/Seoul
- `US OPEN`: U.S. 09:30 America/New_York
- `US CLOSE`: U.S. 16:00 America/New_York

U.S. timestamps are resolved from `America/New_York` through the platform timezone database so daylight-saving transitions are not represented by month or fixed-KST magic numbers. Each market uses its own generated trading calendar; a KRX holiday never suppresses U.S. events and a U.S. holiday never suppresses KRX events.

The timeline event timestamp is the true regular-session boundary. For presentation only, a CLOSE event is displayed one minute before the boundary: KRX 15:29 and U.S. local 15:59 converted to KST. Official daily Close values retain their normal OHLC meaning.

## Per-market session state

Each market persists its own state:

- `phase`: `preopen` | `opened` | `closed`
- `tradingDate`: the market-local trading date whose price state is currently applied, or `null` before a market has entered a session.

The KST game date shown in the header is derived from the common game timestamp and is deliberately separate from a market trading date. For example, U.S. trading date `2026-08-27` may close on KST `2026-08-28`.

### `preopen`

- That market's current trading-date OHLC is not revealed.
- Quotes and portfolio valuation use the latest completed close available before the market's next session.
- Legacy pending pre-open orders may remain queued for backward compatibility and execute once when that market actually opens.

### `opened`

- Only that market's actual raw/unadjusted open is newly revealed.
- High, low, and close remain hidden.
- New buy and sell orders are accepted only for assets belonging to that opened market and execute at the revealed open price.
- Opening one market does not change the other market's quote, index, valuation, order queue, or session state.

### `closed`

- That market's completed raw/unadjusted OHLC bar and official close are revealed.
- Portfolio valuation and market/index quotes may use that completed close.
- New immediate orders are not accepted after CLOSE. The next trading opportunity for that market begins at a later OPEN event.
- Closing one market does not advance the other market's trading date or price state.

## Order execution

The normal flow follows actual market events rather than one combined market day:

```text
KR OPEN -> KRX open-price trading
KR CLOSE -> reveal KRX completed OHLC, KRX trading disabled
US OPEN -> U.S. open-price trading
US CLOSE -> reveal U.S. completed OHLC, U.S. trading disabled
next actual market event -> ...
```

A market OPEN uses the shared market-open execution-context builder to resolve actual unadjusted opens and market-specific settlement dates. This path is shared by manual progression and autoplay. The pure trading engine validates that immediate orders are accepted only while the order's market is `opened` and only at the open price.

For backward compatibility, saves from versions that allowed queued pre-open orders may still contain pending orders. Opening KRX processes only KRX pending orders; opening the U.S. market processes only U.S. pending orders. The other market's queue remains untouched until its own OPEN event.

## Information boundary

Committed daily JSON contains complete historical bars, so runtime selectors enforce the no-lookahead boundary using the asset's own market session rather than the KST display date alone.

- Before that market opens: latest completed prior close only.
- While that market is open: current trading-date open may be shown and used for execution; high/low/close remain hidden.
- After that market closes: current trading-date full OHLC and close may be shown and used for valuation, but not for new orders.

The candlestick chart, asset list/detail quote, portfolio valuation, and major-index cards all use the same market-specific trading-date/session boundary. A KRX event therefore cannot reveal or overwrite U.S. prices, and vice versa.

## Timeline and holidays

`getNextMarketEvent(currentTimestamp)` compares the next valid KRX and U.S. regular-session event and returns whichever occurs first chronologically. Because event candidates come from each market's generated calendar, weekends and market-specific holidays disappear naturally instead of being handled by UI date loops.

Manual progression and autoplay both advance exactly one next market event at a time. Date-boundary processing for settlements, corporate actions, news, and WS Bank loan state remains separate from market-session transitions and runs before the destination event when the common game date changes.

Important corporate events and important news retain their existing manual acknowledgement behavior. During autoplay, those notices remain non-blocking, while WS Bank payment failures and game-over conditions still stop progression. Corporate-action source records remain separate from OHLC data and are not rewritten by the market timeline.

## Autoplay

Autoplay repeatedly invokes the same deterministic `next market event` operation used by manual progression. Speed controls only UI timing; they do not alter market timestamps, execution prices, settlement dates, or economics.

Autoplay does not invent or submit trades. Important corporate events and important news are surfaced through the autoplay notification path without changing event order; loan-payment failures and game-over conditions stop autoplay.

## Save compatibility

The independent timeline advances the save schema to v12. Existing valid saves are migrated rather than deleted:

- legacy `gameDate` remains the basis for the migrated timestamp;
- legacy global session state is conservatively converted into per-market session state;
- existing cash, positions, pending orders, settlements, trades, exchange history, loan state, corporate/news progress, and guidance are retained;
- new saves persist `gameTimestamp`, presentation `gameDisplayTimestamp`, and independent KRX/U.S. market sessions.

Application versioning remains separate from save-schema versioning.
