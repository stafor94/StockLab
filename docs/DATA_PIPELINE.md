# StockLab market-data pipeline

StockLab uses one authoritative provider per market and never mixes price sources.

- Korea: KRX Data Marketplace Open API.
- United States: Alpha Vantage `TIME_SERIES_DAILY`.
- Execution prices are always raw/unadjusted OHLCV.
- Dividends, stock splits, mergers, delistings, and other corporate actions are separate event data and are not applied to historical execution prices.

## Provider interfaces

KRX Open API requires an approved authentication key sent in the `AUTH_KEY` request header. The ingestion code uses these official daily endpoints:

- `sto/stk_bydd_trd` — KOSPI listed stocks.
- `sto/ksq_bydd_trd` — KOSDAQ listed stocks.
- `etp/etf_bydd_trd` — listed ETFs.

KRX documents data availability from 2010 onward for these services.

Alpha Vantage uses `TIME_SERIES_DAILY` with `outputsize=full` and `datatype=json`. This endpoint returns raw/as-traded daily OHLCV. Full historical output currently requires a premium-capable Alpha Vantage key.

Official references:

- https://openapi.krx.co.kr/
- https://www.alphavantage.co/documentation/

## Secrets and masked identities

API credentials and real ticker mappings are build-time secrets. They must never be exposed through client-side Vite environment variables or committed to the public repository.

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

The builder fetches every endpoint required by the mapping but accepts a row only from the endpoint effective on that date. This prevents missing pre-transfer or post-transfer history.

The builder computes the effective in-game listing date from the first actual bar, so post-2018 listings stay unavailable until their historical listing data begins.

## Build

Set credentials in the environment, then run:

```bash
npm run data:build -- --from=2018-01-01 --to=2026-08-25
npm run data:check
npm run data:coverage -- --strict-market
```

Useful flags:

- `--force`: ignore raw response cache and re-fetch provider data.
- `--allow-partial`: build only source mappings present in the private map. Development only; release datasets should contain the complete catalog.

Provider responses are cached under `.cache/market-data/` so interrupted builds can resume without re-requesting completed dates/symbols.

## GitHub Actions refresh

The manual **Refresh authoritative market data** workflow can build provider data without exposing credentials to the browser or committing the private symbol map. Configure repository secrets:

- `KRX_AUTH_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `BOK_ECOS_API_KEY`
- `MARKET_SOURCE_MAP_JSON`

The workflow materializes the map only inside the runner, builds market/FX/base-rate data, validates strict coverage, uploads `public/data` as an artifact, and pushes changed generated data to a review branch. It does not write generated provider data directly to `main`.

## Generated files

The builder writes price files first and `manifest.json` last. This prevents the browser from seeing a manifest that points at half-generated files.

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

The U.S. calendar uses a broad U.S. ETF (`SPY` by default) only as an Alpha Vantage trading-date probe. It is not exposed as a hidden source mapping for any game asset unless separately mapped.

## Validation

`npm run data:check` verifies:

- the masked catalog contains exactly 109 unique stable IDs and output paths;
- generated manifest metadata matches the catalog;
- asset files match manifest market/kind/currency metadata;
- daily bars are strictly ordered and unique;
- OHLC relationships are valid;
- every bar date exists in its market calendar;
- no generated file is accepted as a substitute for KRX/Alpha Vantage source data.

`npm run data:coverage` reports whether market calendars/assets remain bootstrap/incomplete and also summarizes corporate/news coverage. `--strict-market` fails unless all 109 catalog assets and generated KR/US calendars are present.

CI runs catalog/static-data validation and the non-strict coverage report without network credentials. The committed bootstrap calendars remain valid until a full authoritative dataset is generated.
