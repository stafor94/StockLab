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

U.S. history has an additional strict gate:

```bash
npm run data:us:check
```

This requires all 45 U.S. stocks and 12 U.S. ETFs, generated Nasdaq trading dates, complete post-listing date coverage, historical-unadjusted source metadata, and verified split restoration state.

## Current U.S. generated coverage

The v0.15.0 Nasdaq build produced 57 masked U.S. asset series with 120,649 daily bars covering 2018-01-02 through 2026-08-24. Four catalog assets begin after the game start because their actual listing histories start later. Strict validation found zero missing trading dates after each asset's first available Nasdaq bar.

Nasdaq Historical Quotes can report unavailable historical volume. These values are retained as `null` rather than fabricated as zero; the v0.15.0 build contains two such bars. Official Nasdaq OHLC fields are also preserved verbatim when provider-side historical adjustments create cross-field inconsistencies.

## Corporate-action completeness

Corporate actions have three source modes:

- `empty-seed`: no verified actions have been loaded yet
- `curated-partial`: every committed event is source-backed, but the dataset is not comprehensive
- `generated`: the build process considers the configured coverage comprehensive

`curated-partial` is deliberately different from `generated`. It prevents a small set of verified events from being mistaken for a complete dividend/split/merger history.

The initial v0.12.0 curated set contains the 2018 K001 50:1 stock split plus its official trading suspension and resumption schedule. The v0.15.0 U.S. build also writes verified split events used to restore Nasdaq price scale; gameplay corporate actions remain separate from execution-price history. Regular dividends and the rest of the 109-asset corporate-action history still require comprehensive source work.

## Private market source map

Generate a safe template locally:

```bash
npm run data:source-map:template
```

This writes:

```text
.private/market-source-map.template.json
```

The template contains game IDs and provider structure but leaves real symbols blank. Fill every symbol and save the result as:

```text
.private/market-source-map.json
```

Do not commit the completed mapping.

KRX source mappings support dated `endpointChanges`. This is required for assets such as K017 that changed Korean market venue during the historical period. A single current-market endpoint is not sufficient for complete historical bars.

## GitHub Actions refresh

The manual workflow **Refresh authoritative market data** requires these repository secrets:

- `KRX_AUTH_KEY`
- `BOK_ECOS_API_KEY`
- `MARKET_SOURCE_MAP_JSON` — the complete contents of the private source map

Nasdaq Historical Quotes does not require a StockLab API credential; real U.S. symbols still remain private build inputs.

The workflow:

1. materializes the private source map only inside the Actions runner
2. downloads official KRX and Nasdaq historical OHLCV
3. restores Nasdaq split-adjusted price history to historical unadjusted scale only from verified dated split ratios
4. builds Bank of Korea USD/KRW and base-rate data
5. runs all dataset validators, including `data:us:check`
6. requires strict 109-asset market coverage
7. uploads the generated `public/data` as a short-lived artifact
8. pushes changed public data to a `data/refresh-*` review branch
9. attempts to open a PR instead of writing directly to `main`

If repository policy blocks Actions-created PRs, the review branch and workflow artifact still preserve the generated output for manual review.

## U.S. history dependency

Production U.S. prices come from Nasdaq Historical Quotes only. If Nasdaq does not return the required historical rows, the build fails rather than substituting another finance website. Third-party datasets may be used only for verification and are never mixed into production price files.

If Nasdaq history is split-adjusted, the builder may restore historical unadjusted prices only when a verified split/reverse-split event and surrounding prices allow the adjustment state to be classified safely. Ambiguous split state causes the build to fail instead of guessing.

## News coverage

News is curated rather than mechanically exhaustive. Every item must:

- describe a real event
- have at least one HTTPS source reference
- use original StockLab wording rather than copying an article
- preserve historical reveal timing (`PRE_OPEN`, `INTRADAY`, `POST_CLOSE`)
- use masked game identities in player-facing text

The initial v0.12.0 news file covers selected 2018 company, monetary-policy, and trade-policy milestones. Additional years should be added as separate `public/data/news/YYYY.json` files and registered in `manifest.json`.
