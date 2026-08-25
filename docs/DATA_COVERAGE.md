# Historical data coverage

StockLab treats data completeness as an explicit runtime/build concern. Missing historical data must never be silently replaced with fabricated prices, exchange rates, corporate actions, or news.

## Coverage commands

```bash
npm run data:coverage
```

The report shows:

- generated market assets versus the 109-asset catalog
- KRX and U.S. calendar coverage/mode
- corporate-action event count and source mode
- curated news item/year coverage

For a full authoritative market refresh, use:

```bash
npm run data:coverage -- --strict-market
```

Strict market mode fails unless all 109 assets are present and both market calendars were generated from the configured providers rather than bootstrap seeds.

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

The template contains game IDs, providers, and KRX endpoint history but leaves real symbols blank. Fill every symbol and save the result as:

```text
.private/market-source-map.json
```

Do not commit the completed mapping.

KRX source mappings support dated `endpointChanges`. This is required for assets such as K017 that changed Korean market venue during the historical period. A single current-market endpoint is not sufficient for complete historical bars.

## GitHub Actions refresh

The manual workflow **Refresh authoritative market data** requires these repository secrets:

- `KRX_AUTH_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `BOK_ECOS_API_KEY`
- `MARKET_SOURCE_MAP_JSON` — the complete contents of the private source map

The workflow:

1. materializes the private source map only inside the Actions runner
2. downloads KRX and Alpha Vantage raw/unadjusted OHLCV
3. builds Bank of Korea USD/KRW and base-rate data
4. runs all dataset validators
5. requires strict 109-asset market coverage
6. uploads the generated `public/data` as a short-lived artifact
7. pushes changed public data to a `data/refresh-*` review branch
8. attempts to open a PR instead of writing directly to `main`

If repository policy blocks Actions-created PRs, the review branch and workflow artifact still preserve the generated output for manual review.

## U.S. history dependency

Full Alpha Vantage daily history must be available for every configured U.S. asset. If the configured API plan cannot return the requested full historical range, the build must fail rather than switching to another finance provider.

## News coverage

News is curated rather than mechanically exhaustive. Every item must:

- describe a real event
- have at least one HTTPS source reference
- use original StockLab wording rather than copying an article
- preserve historical reveal timing (`PRE_OPEN`, `INTRADAY`, `POST_CLOSE`)
- use masked game identities in player-facing text

The initial v0.12.0 news file covers selected 2018 company, monetary-policy, and trade-policy milestones. Additional years should be added as separate `public/data/news/YYYY.json` files and registered in `manifest.json`.
