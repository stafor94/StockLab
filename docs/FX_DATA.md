# USD/KRW FX data

StockLab uses **Bank of Korea ECOS** as the sole production source for daily USD/KRW exchange rates. Third-party FX prices are not mixed into gameplay data.

## Series

- Provider: Bank of Korea Economic Statistics System (ECOS)
- Statistic code: `731Y001`
- Item code: `0000001`
- Frequency: daily (`D`)
- API: `https://ecos.bok.or.kr/api/StatisticSearch`
- Runtime output: `public/data/fx/usd-krw.json`

The configured codes are validated against `STAT_CODE` and `ITEM_CODE1` in the official ECOS `StatisticSearch` response before rows are accepted.

## Build

```bash
BOK_ECOS_API_KEY=... npm run data:fx:build
npm run data:fx:check
```

Optional date controls use the same `MARKET_DATA_FROM` and `MARKET_DATA_TO` variables as the market-data build. Raw ECOS responses are cached under `.cache/market-data/bok-ecos/` and are not committed. The provider paginates ECOS responses; the ECOS public `sample` key is also supported for reproducibility but is intentionally slower because its page size is limited.

The builder requests a short lookback before the configured game-data start and stores only the last real ECOS observation from that lookback as a carry-in anchor. This lets `2018-01-01` and other non-publication days resolve to an actual prior official rate without inventing a synthetic row.

## Runtime rule

The game chooses the latest Bank of Korea rate whose date is **not later than** the current game date. Weekends and Korean holidays therefore reuse the latest published official rate. No interpolation is performed and no future observation may be selected.

## Validation

`npm run data:fx:check` is strict and fails if the committed FX file is missing or invalid. It verifies:

- exact ECOS provider/statistic/item/frequency/API metadata;
- first/last row alignment with declared coverage;
- strictly increasing, unique dates and positive finite rates;
- a real carry-in observation usable on the game start date;
- coverage through the latest committed KR/US market-calendar date;
- no abnormally long published-data gaps;
- historical lookup on committed market dates without future lookahead.

Representative official ECOS observations are also pinned in regression tests so accidental source or value changes are detected by the unit-test suite.

## WS Securities spread

WS Securities is fictional. Exchange is available regardless of whether the Korean or U.S. stock market is open. The representative FX pricing rule is:

- Base spread: 1.00%
- Korean regular-session preferential discount: 95%
- Preferential effective spread: 0.05%

The 95% preferential discount applies only while the Korean market session is `opened`. Before the Korean open, after the Korean close, on Korean holidays, and while only the U.S. market is open, the base 1.00% spread applies.

For KRW → USD, the active spread is added to the Bank of Korea reference rate. For USD → KRW, it is subtracted. USD is rounded down to cents and KRW to whole won.

No automatic FX conversion is performed for U.S. stock purchases, settlement, or loan-interest payments.
