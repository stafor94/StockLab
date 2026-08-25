# StockLab market-data pipeline

StockLab uses one authoritative price provider per market and never mixes production price sources.

- Korea: official KRX data.
- United States: Nasdaq Historical Quotes.
- Execution prices are historical unadjusted/as-traded OHLC.
- If Nasdaq serves split-adjusted historical rows, StockLab restores the earlier price/volume scale with verified dated split ratios before runtime data is written.
- Dividends, splits/reverse splits, mergers, delistings, and other corporate actions remain separate dated event data; price restoration never substitutes for event processing.
- Third-party market-data sites may be used only for verification, never as a production price fallback.

## Provider interfaces

### Korea — KRX

KRX Open API requires an approved authentication key sent in the `AUTH_KEY` request header. The ingestion code supports the official daily endpoints used by the private source map:

- `sto/stk_bydd_trd` — KOSPI listed stocks.
- `sto/ksq_bydd_trd` — KOSDAQ listed stocks.
- `etp/etf_bydd_trd` — listed ETFs.

KRX source mappings can change endpoint by effective date so a venue transfer does not erase earlier history.

Official reference: https://openapi.krx.co.kr/

### United States — Nasdaq Historical Quotes

The U.S. builder reads Nasdaq Historical Quotes for each privately mapped stock/ETF and requests the complete configured date range. Large responses are split into smaller date windows when the provider reports more rows than a single response returned.

Nasdaq historical rows are preserved as delivered before any verified split restoration. Nasdaq can expose independently adjusted OHLC fields that do not always satisfy ordinary cross-field relationships and can report historical volume as `N/A`. StockLab therefore:

- never clamps or synthesizes Nasdaq OHLC values;
- requires all OHLC values to be finite and positive;
- preserves unavailable Nasdaq volume as `null` rather than fabricating zero volume;
- keeps KRX OHLC relationship validation strict;
- restores only split-adjusted historical periods whose split dates and ratios are verified.

Official references:

- https://www.nasdaq.com/market-activity
- https://www.nasdaq.com/market-activity/stock-splits

## Secrets and masked identities

Real symbols and credentials are build-time inputs. They must never be exposed through client-side Vite environment variables or committed to the public repository.

Generate a complete 109-asset private-map template with:

```bash
npm run data:source-map:template
```

Fill every blank `symbol` locally and save the completed mapping as:

```text
.private/market-source-map.json
```

`.private/` is gitignored. The public catalog in `config/assets.ts` contains only stable game IDs, aliases, asset types, markets, sectors, and output paths.

The older `config/market-source-map.example.json` remains a compact format example; the generator is the canonical way to prepare a complete map.

## KRX venue history

A Korean stock can move between KRX market venues during the game period. The source-map format therefore supports `endpointChanges` with effective dates instead of assuming one endpoint for all historical bars.

Example shape:

```json
{
  "provider": "KRX",
  "endpoint": "ksq_bydd_trd",
  "endpointChanges": [
    { "effectiveFrom": "2018-02-09", "endpoint": "stk_bydd_trd" }
  ],
  "symbol": "..."
}
```

The builder fetches every endpoint required by the mapping but accepts a row only from the endpoint effective on that date. The effective in-game listing date is the first actual bar, so post-2018 listings remain unavailable before their historical listing.

## Build

Full KRX + U.S. build:

```bash
KRX_AUTH_KEY=... npm run data:build -- --from=2018-01-01 --to=2026-08-25
```

U.S.-only Nasdaq build:

```bash
npm run data:us:build -- --from=2018-01-01 --to=2026-08-25
npm run data:us:check
```

Common validation:

```bash
npm run data:check
npm run data:coverage -- --strict-market
```

Useful flags:

- `--force`: ignore raw provider response cache and re-fetch.
- `--allow-partial`: development-only partial build; release datasets must contain the complete configured catalog.

Provider responses are cached under `.cache/market-data/` so interrupted builds can resume without re-requesting completed dates/symbols.

## Split restoration

Verified split/reverse-split events use masked game IDs and effective dates. For each event, the U.S. builder compares the price scale immediately before and after the effective date:

1. If Nasdaq rows are already on the post-split scale, earlier OHLC is multiplied by the verified split factor and historical volume is divided by that factor.
2. If the rows are already unadjusted, they are left unchanged.
3. If the state cannot be classified safely, the build fails rather than guessing.
4. `null` provider volume remains `null` through restoration.

The corresponding split event is still written/maintained in the corporate-action dataset so gameplay adjusts holdings on the historical event date.

## GitHub Actions refresh

The manual **Refresh authoritative market data** workflow requires repository secrets:

- `KRX_AUTH_KEY`
- `BOK_ECOS_API_KEY`
- `MARKET_SOURCE_MAP_JSON`

Nasdaq Historical Quotes does not require an Alpha Vantage key. The workflow materializes the private map only inside the runner, builds KRX/Nasdaq/BOK datasets, runs strict U.S. and full coverage validation, removes the private map, uploads generated public data as an artifact, and pushes changes to a review branch rather than directly changing `main`.

## Generated files

The builder writes price files before `manifest.json` so the browser never sees a manifest pointing at half-generated files.

```text
public/data/
├─ manifest.json
├─ calendars/
│  ├─ kr.json
│  └─ us.json
├─ stocks/
│  ├─ kr/K001.json
│  └─ us/U001.json
└─ etf/
   ├─ kr/KE001.json
   └─ us/UE001.json
```

The U.S. calendar is generated from actual trading dates present in the Nasdaq asset histories; it does not rely on a hidden third-party or probe ticker.

## Validation

`npm run data:check` verifies catalog/manifest consistency, metadata, ascending unique dates, market-calendar membership, positive finite OHLC, and valid volume representation. KRX retains strict ordinary OHLC relationship checks. Nasdaq values are preserved rather than rewritten to satisfy a derived relationship.

`npm run data:us:check` additionally requires:

- exactly 45 U.S. stocks and 12 U.S. ETFs;
- Nasdaq Historical Quotes source metadata and historical-unadjusted price basis;
- generated U.S. calendar and known closure checks;
- complete trading-date coverage between each asset's first and latest bar;
- verified split events to read as unadjusted in production data;
- no unexplained large price-scale discontinuities;
- explicit reporting of `null`/unavailable Nasdaq volume rows.

`npm run data:coverage` reports market/calendar/content completeness. `--strict-market` fails unless the complete catalog and generated KR/US calendars are present.

CI runs lint, typecheck, unit tests, static dataset checks, strict U.S. validation, build, and responsive Playwright coverage before release changes can merge.
