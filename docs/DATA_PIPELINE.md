# StockLab market-data pipeline

StockLab uses one authoritative price source per market and never mixes providers inside a market history.

- Korea: official KRX data served by KRX KIND (`kind.krx.co.kr`).
- United States production authority: Stooq. The obsolete Alpha Vantage production adapter has been removed; a U.S. dataset must not be generated until the dedicated Stooq ingestion path is implemented and validated.
- Execution prices are always raw/unadjusted OHLCV.
- Dividends, stock splits, mergers, delistings, and other corporate actions are separate event data and are not applied to historical execution prices.

## Korean provider: KRX KIND

The Korean production builder does not require a KRX Open API authentication key.

For each private 6-digit KRX symbol, it uses two KRX-operated KIND interfaces:

1. `/common/corpbasicinfo.do?method=searchCorpBasicInfo&cd_or_nm=A{symbol}` resolves the KRX symbol to the KIND issuer code and verifies the returned short code/ISIN.
2. `/corpdetail/chart.do` with `method=loadFlexForDisclsAnalysisChart` and `infotype=prsntprc` returns the daily historical chart series containing `open`, `high`, `low`, `close`, and `admnt` (volume).

The builder fetches history in yearly chunks and caches raw KIND responses under `.cache/market-data/krx-kind/`. This keeps retries resumable and avoids one oversized request for the full 2018-current period.

The same KIND chart path is used for both listed stocks and ETFs. KODEX 200 (`069500`, `KR7069500007`) was verified to return the same daily OHLCV structure as stocks.

### Executable-bar filtering

KIND can emit chart display rows on dates when a security did not trade. Samsung Electronics' 2018 split halt was verified to return stale `2,650,000` OHLC with volume `0` on 2018-04-30, 2018-05-02, and 2018-05-03. These are not executable market prices.

The production normalizer therefore excludes every zero-volume KIND row. Generated Korean price files contain only positive-volume daily bars, and strict Korean validation fails if a zero-volume bar appears.

### Raw-price regression

KRX KIND preserves actual historical, non-back-adjusted prices. K001/Samsung Electronics was verified across its 2018 50:1 split:

- 2018-04-27: open 2,669,000 / high 2,682,000 / low 2,622,000 / close 2,650,000 / volume 606,216.
- 2018-05-04: open 53,000 / high 53,900 / low 51,800 / close 51,900 / volume 39,565,391.

`npm run data:kr:check` pins these values and also requires the three verified halt dates above to be absent from K001's executable series. This prevents both adjusted-price regressions and stale halt rows from silently becoming execution data.

## Private masked identities

Real ticker mappings are build-time private data. They must never be exposed through client-side Vite environment variables or committed to the public repository.

Generate the private-map template with:

```bash
npm run data:source-map:template
```

Fill the real symbols outside version control and save the completed mapping as:

```text
.private/market-source-map.json
```

`.private/` is gitignored. The public catalog in `config/assets.ts` contains only stable game IDs, aliases, asset types, markets, sectors, and output paths.

For Korean entries, the KRX source shape remains:

```json
{
  "provider": "KRX",
  "endpoint": "stk_bydd_trd",
  "endpointChanges": [],
  "symbol": "005930"
}
```

`endpoint` / `endpointChanges` remain historical venue metadata for compatibility with tax/trading-cost and other venue-sensitive rules. The KIND historical builder does not split price collection by KOSPI/KOSDAQ endpoint; a single KIND issuer series follows the security across venue changes.

U.S. private-map entries use `provider: "STOOQ"` and a Stooq identifier ending in `.US`. The source-map validator rejects the retired `ALPHA_VANTAGE` provider.

The Korean builder computes the effective in-game listing date from the first actual positive-volume bar, so post-2018 listings remain unavailable before their true executable history begins.

## Korean build

Build all 40 Korean stocks and 12 Korean ETFs with:

```bash
npm run data:kr:build -- --from=2018-01-01 --to=2026-08-25
npm run data:kr:check
npm run data:check
npm run data:coverage
```

Useful controls:

- `--force`: ignore cached KRX KIND responses and re-fetch them.
- `KRX_KIND_REQUEST_DELAY_MS`: delay between KIND requests; default `120` ms.
- `MARKET_SOURCE_MAP_PATH`: override the default `.private/market-source-map.json` path.
- When `--to` is omitted, the builder resolves the current date in `Asia/Seoul` rather than UTC.

The Korean builder writes the 52 masked asset files, regenerates the Korean trading calendar from the union of actual executable KRX bars, and updates only Korean manifest entries. Existing non-Korean manifest entries are preserved.

## Korean GitHub Actions build

The manual **Build Korean KRX KIND history** workflow requires only the repository secret:

- `MARKET_SOURCE_MAP_JSON`

No `KRX_AUTH_KEY` is required for this path. The secret is exposed only to the step that materializes the ignored private map. The workflow builds all 52 Korean series, runs strict Korean validation plus code quality gates, uploads a short-lived artifact, and pushes generated masked public data to a review branch. It never writes generated provider data directly to `main`. If repository policy blocks Actions-created PRs, the generated review branch and artifact remain available.

## Bank of Korea reference-data workflow

The old mixed KRX/Alpha Vantage market refresh has been retired. **Refresh Bank of Korea reference data** only updates ECOS FX and base-rate datasets. This prevents a legacy provider path from overwriting KRX KIND or future Stooq market history.

## Generated files

Price files are written before `manifest.json`, so the runtime never receives a manifest that points at half-generated Korean files.

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

## Validation

`npm run data:kr:check` requires:

- exactly 40 Korean stocks and 12 Korean ETFs in the manifest;
- the Korean calendar to be generated from `KRX KIND` and start at `2018-01-01` coverage;
- non-empty, strictly ascending, unique daily bars;
- positive OHLC and strictly positive executed volume;
- every bar date to exist in the Korean calendar;
- manifest/series metadata to match the masked catalog;
- the K001 2018 pre/post-split raw-price regression values to remain exact;
- verified zero-volume K001 halt dates not to appear as executable bars.

`npm run data:check` validates every generated asset currently present. With `--allow-bootstrap` it permits a partially populated KR/US manifest during staged authoritative builds, while still validating every file that exists. A strict full-market release still uses `npm run data:coverage -- --strict-market` and requires the complete 109-asset market dataset.

CI remains network-free: unit tests use pinned official-response fixtures, while live KIND connectivity is exercised only by explicit diagnostic/data-build workflows. This keeps normal lint/typecheck/test/build/E2E gates deterministic.
