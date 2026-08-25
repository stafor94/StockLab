# Historical data coverage

StockLab treats data completeness as an explicit runtime/build concern. Missing historical data must never be silently replaced with fabricated prices, exchange rates, corporate actions, or news.

## Coverage commands

```bash
npm run data:coverage
```

The report shows:

- generated market assets versus the 109-asset catalog
- Korean and U.S. calendar coverage/mode
- corporate-action event count and source mode
- curated news item/year coverage

For a full production market release, use:

```bash
npm run data:coverage -- --strict-market
```

Strict market mode fails unless all 109 assets are present and both market calendars were generated from the configured authoritative providers rather than bootstrap seeds.

## Korean market coverage

Korean stocks and ETFs use official KRX data collected through KRX-operated KIND. The production Korean builder is intentionally all-or-nothing for the 52 Korean catalog assets:

```bash
npm run data:kr:build -- --from=2018-01-01 --to=2026-08-25
npm run data:kr:check
```

`data:kr:check` requires exactly 40 Korean stocks and 12 Korean ETFs, a generated KRX KIND calendar beginning at 2018-01-01, strictly positive-volume executable daily bars, and the pinned K001 2018 raw split regression values.

The builder uses yearly KIND history chunks. Live verification against KRX returned 244 chart rows for both Samsung Electronics and KODEX 200 for calendar year 2018, confirming the yearly request boundary used by the collector. Samsung Electronics' response includes three zero-volume stale-price rows on 2018-04-30, 2018-05-02, and 2018-05-03 during its trading halt; these are display-only KIND rows, not execution days, and the production normalizer excludes them.

## U.S. market coverage

The production authority for U.S. stocks and ETFs is Stooq. U.S. history must be generated through the dedicated Stooq production path. Legacy provider code must not be used to fill missing U.S. dates or symbols.

A full release is not complete until all 57 U.S. catalog assets and the U.S. trading calendar pass their production validation in addition to the 52 Korean assets.

## Corporate-action completeness

Corporate actions have three source modes:

- `empty-seed`: no verified actions have been loaded yet
- `curated-partial`: every committed event is source-backed, but the dataset is not comprehensive
- `generated`: the build process considers the configured coverage comprehensive

`curated-partial` is deliberately different from `generated`. It prevents a small set of verified events from being mistaken for a complete dividend/split/merger history.

The initial v0.12.0 curated set contains the 2018 K001 50:1 stock split plus its official trading suspension and resumption schedule. Regular dividends and the rest of the 109-asset corporate-action history still require comprehensive source work.

## Private market source map

Generate a safe template locally:

```bash
npm run data:source-map:template
```

This writes:

```text
.private/market-source-map.template.json
```

The template contains game IDs and provider metadata but leaves real symbols blank. Fill every real symbol outside version control and save the result as:

```text
.private/market-source-map.json
```

Do not commit the completed mapping.

Korean mappings retain dated KRX venue metadata such as `endpointChanges` where required by tax/trading-cost/history rules. KIND historical price collection itself follows the resolved issuer series and does not need to split OHLC retrieval by KOSPI/KOSDAQ endpoint.

## GitHub Actions data builds

### Korean KRX KIND history

The manual workflow **Build Korean KRX KIND history** requires:

- `MARKET_SOURCE_MAP_JSON` — the complete private source-map contents

It does not require `KRX_AUTH_KEY`.

The workflow:

1. exposes the private mapping secret only to the materialization step
2. writes it to ignored `.private/market-source-map.json` inside the runner
3. rebuilds Korean history from 2018-01-01 through the requested end date
4. excludes zero-volume non-trading chart rows and runs strict 52-asset Korean validation plus repository quality gates
5. uploads only generated Korean public data as a short-lived artifact
6. pushes changes to a `data/krx-kind-*` review branch
7. attempts to open a PR instead of writing directly to `main`; if repository policy blocks PR creation, the generated branch and artifact remain available
8. removes the private mapping in an `always()` cleanup step

### Bank of Korea reference data

The former mixed KRX/Alpha Vantage refresh workflow has been retired. **Refresh Bank of Korea reference data** now updates only ECOS USD/KRW and base-rate datasets using `BOK_ECOS_API_KEY`. Market OHLC is deliberately excluded so an obsolete provider cannot overwrite KRX KIND or Stooq production history.

## Staged builds

`npm run data:check` validates every generated asset currently present. Its bootstrap mode allows a staged KR-only or US-only authoritative build while still checking every referenced file and manifest entry. This staged allowance does not make a partial dataset release-ready; `data:coverage -- --strict-market` remains the full 109-asset release gate.

## News coverage

News is curated rather than mechanically exhaustive. Every item must:

- describe a real event
- have at least one HTTPS source reference
- use original StockLab wording rather than copying an article
- preserve historical reveal timing (`PRE_OPEN`, `INTRADAY`, `POST_CLOSE`)
- use masked game identities in player-facing text

The initial v0.12.0 news file covers selected 2018 company, monetary-policy, and trade-policy milestones. Additional years should be added as separate `public/data/news/YYYY.json` files and registered in `manifest.json`.
