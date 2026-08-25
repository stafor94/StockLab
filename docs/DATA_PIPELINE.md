# StockLab market-data pipeline

StockLab uses one production price authority per market and never mixes price providers within a market history.

- Korea: official KRX data served by KRX-operated KIND.
- United States: Nasdaq Historical Quotes.
- Executions use historical raw/unadjusted OHLC.
- Corporate actions are separate dated events.
- Third-party data such as Stooq is verification-only and must never enter production price files.

## Korean pipeline: KRX KIND

The Korean builder resolves each private six-digit KRX symbol through KIND and downloads historical daily chart data containing open, high, low, close, and executed volume. Responses are cached in yearly chunks under `.cache/market-data/krx-kind/`.

KIND display-only rows with zero executed volume are excluded from executable bars. The K001 2018 50:1 split regression pins actual raw prices before and after the halt so adjusted prices or stale halt rows cannot silently enter gameplay.

Build and validate:

```bash
npm run data:kr:build -- --from=2018-01-01 --to=2026-08-25
npm run data:kr:check
```

The committed Korean release contains 40 stocks and 12 ETFs and a generated KRX calendar.

## U.S. pipeline: Nasdaq Historical Quotes

The U.S. builder uses Nasdaq's historical quote interface at build time with the private symbol and `assetClass` (`stocks` or `etf`). Provider responses are cached under `.cache/market-data/nasdaq/`, and large date ranges can be divided recursively when the provider reports more records than one response contains.

The public browser never calls Nasdaq. Only static masked JSON generated at build time is shipped under `public/data/`.

Build and validate:

```bash
npm run data:us:build -- --from=2018-01-01 --to=2026-08-25
npm run data:us:check
```

The v0.17.0 generation produced:

- 45 U.S. stocks + 12 U.S. ETFs = 57 assets;
- 119,908 daily bars;
- first U.S. executable date 2018-01-02;
- latest completed Nasdaq session available to the build 2026-08-24;
- 5 securities whose first executable history begins after the global coverage start;
- 2 provider rows where historical volume is unavailable, preserved as `null` rather than fabricated.

### Split-adjusted Nasdaq history

Nasdaq historical rows can be expressed on a split-adjusted scale. StockLab does not use those adjusted values as historical execution prices.

Verified dated split/reverse-split ratios are stored separately from the private ticker map using masked game IDs. For each verified event the builder classifies the surrounding Nasdaq history as already raw, adjusted, or ambiguous. Only rows positively classified as adjusted are restored to the historical unadjusted scale. Ambiguous classification fails the build.

For a forward split with ratio `numerator:denominator`, all pre-effective-date OHLC values are multiplied by `numerator / denominator`; split-adjusted volume is divided by the same cumulative factor. Reverse splits use the same formula with a ratio below 1. Corporate-action events remain separate and still adjust portfolio share counts/average cost on their effective dates.

The current U.S. catalog has 11 verified split events affecting 9 assets. Regression coverage includes the representative AAPL 2020, TSLA 2020/2022, NVDA 2021/2024, AMZN 2022, and GOOG/GOOGL 2022 split cases.

## Private masked identities

Real ticker mappings are private build-time inputs and are never committed to runtime data.

```bash
npm run data:source-map:template
```

Save the completed map as `.private/market-source-map.json`.

Korean example:

```json
{
  "provider": "KRX",
  "endpoint": "stk_bydd_trd",
  "endpointChanges": [],
  "symbol": "FILL_6_DIGIT_KRX_CODE"
}
```

U.S. examples:

```json
{ "provider": "NASDAQ", "assetClass": "stocks", "symbol": "FILL_US_SYMBOL" }
{ "provider": "NASDAQ", "assetClass": "etf", "symbol": "FILL_US_ETF_SYMBOL" }
```

The source-map parser rejects a U.S. production mapping that is not `NASDAQ` and rejects a Korean production mapping that is not `KRX`.

## Generated files

```text
public/data/
├─ manifest.json
├─ calendars/kr.json
├─ calendars/us.json
├─ stocks/kr/Kxxx.json
├─ stocks/us/Uxxx.json
├─ etf/kr/KExxx.json
├─ etf/us/UExxx.json
└─ events/corporate.json
```

Public price files contain game IDs, market/kind/currency, non-secret source metadata, and bars. They do not contain the real ticker mapping.

## Validation gates

`npm run data:kr:check` validates all 52 KRX series, executable-volume rules, calendar membership, and the K001 raw split/halt regression.

`npm run data:us:check` validates all 57 Nasdaq series, generated calendar membership, listing boundaries, price/date ordering, known holidays, split restoration state, and unexplained scale discontinuities. The current release reports `missingTradingDates: 0`.

`npm run data:check` validates the combined manifest and files. `npm run data:coverage -- --strict-market` requires the complete 109-asset generated KR/US market dataset.

Normal CI is network-free and validates committed artifacts. Live provider access is limited to explicit build workflows or local data-generation runs.
