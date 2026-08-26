# Historical data coverage

StockLab treats completeness as an explicit build/runtime property. Missing history is never silently filled with fabricated prices, volume, FX, corporate actions, or news.

## Coverage gates

```bash
npm run data:coverage
npm run data:coverage -- --strict-market
npm run data:kr:check
npm run data:us:check
npm run data:fx:check
npm run data:rates:check
npm run data:events:check
npm run data:news:check
```

Strict market mode requires all 109 catalog assets plus generated Korean and U.S. calendars. FX and base-rate production validation is also strict: committed Bank of Korea ECOS production datasets must exist and cannot fall back to bootstrap/missing-data allowances.

## v0.18.0 production market coverage

| Market | Stocks | ETFs | Total | Production source | Coverage |
| --- | ---: | ---: | ---: | --- | --- |
| Korea | 40 | 12 | 52 | KRX-operated KIND | 2018-01-01 through 2026-08-25 calendar coverage |
| U.S. | 45 | 12 | 57 | Nasdaq Historical Quotes | 2018-01-02 through 2026-08-24 latest completed session |
| Combined | 85 | 24 | 109 | KRX + Nasdaq | 109/109 generated assets |

The U.S. release contains 119,908 daily bars. Five securities begin after the global 2018 start because they were not yet listed. Strict validation reports zero missing trading dates from each asset's first executable bar through the latest generated session.

Two Nasdaq historical rows report unavailable volume. These remain `null`; zero or synthetic volume is not invented.

Historical execution prices remain actual raw/unadjusted OHLC. Nasdaq histories are restored from split-adjusted scale only when a verified dated ratio supports that restoration. Dividends and other corporate actions never rewrite execution OHLC.

## Bank of Korea USD/KRW coverage

Production source: Bank of Korea ECOS, daily series `731Y001 / 0000001`.

- 2,130 official observations.
- First committed observation / game-start carry-in: 2017-12-29, USD/KRW 1071.4.
- Latest committed observation: 2026-08-25.
- Only actual ECOS publication rows are stored; weekends/holidays do not receive synthetic rows.
- Historical lookup uses the latest official observation with `observation.date <= gameDate`; future rates are never used.
- Both KRW → USD and USD → KRW continue to use the existing WS Securities spread rules around the same historical reference rate.

## Bank of Korea base-rate coverage

Production source: Bank of Korea ECOS, `722Y001 / 0101000`.

- Full game-period effective history through 2026-08-25.
- 21 effective rows including the 2017-11-30 1.50% carry-in.
- No unchanged-date rows are fabricated.
- Effective-date lookup never applies a future rate early.
- WS Bank contract pricing remains BOK base rate + 3.0%p; this release does not alter the bank spread rule.

## Historical news coverage

News remains **curated coverage**, not an exhaustive archive.

| Year | Items | Important |
| --- | ---: | ---: |
| 2018 | 10 | 9 |
| 2019 | 8 | 4 |
| 2020 | 10 | 5 |
| 2021 | 7 | 4 |
| 2022 | 11 | 4 |
| 2023 | 10 | 4 |
| 2024 | 8 | 2 |
| 2025 | 9 | 4 |
| 2026 | 7 | 3 |
| **Total** | **80** | **39** |

News is stored in per-year files and loaded lazily. Before a manual/autoplay date advance crosses into a new year, the target year is preloaded and cached. A load failure leaves the game date unchanged, and important-news stop logic runs before progression can continue. No news item extends beyond 2026-08-25 gameplay coverage.

## Corporate-action coverage

Corporate-action source modes remain separate from market-price completeness:

- `empty-seed`: no verified actions loaded;
- `curated-partial`: included events are verified but coverage is not comprehensive;
- `generated`: configured event coverage is comprehensive.

The v0.18.0 dataset remains **`curated-partial`** and contains 62 events:

| Type | Events |
| --- | ---: |
| DIVIDEND | 34 |
| SPLIT | 12 |
| LISTING | 14 |
| HALT | 1 |
| RESUME | 1 |
| **Total** | **62** |

Source-backed encoded/researched corporate actions currently cover 25 assets, while catalog consistency is checked against all 109 assets. This is an expansion, not corporate-action completion. Remaining work includes additional dividends/distributions across the other assets, ETF distributions, exhaustive M&A and delisting coverage, exhaustive halt/resume history, and other unverified action types.

All U.S. `SPLIT` gameplay events are cross-validated against the verified Nasdaq raw-price restoration table by asset ID, effective date, numerator, and denominator, and every verified restoration split must have exactly one matching gameplay event. Dividend processing remains separate from OHLC and reconstructs entitlement from persisted executions as of the ex-date.

## Korean strict validation

```bash
npm run data:kr:check
```

Requires exactly 40 stocks and 12 ETFs, generated KRX calendar membership, positive executable volume, valid OHLC, and the pinned K001 2018 raw split/halt regression. Zero-volume KIND display rows during a halt are excluded from execution history.

## U.S. strict validation

```bash
npm run data:us:check
```

Requires exactly 45 stocks and 12 ETFs, a generated Nasdaq calendar, non-empty ordered price histories, valid listing boundaries, known holiday handling, no missing expected trading dates, and raw/unadjusted state around every verified split event.

The current catalog contains 11 verified U.S. split events across 9 assets. Nasdaq split-adjusted history is restored only where the surrounding data and verified ratio classify it as adjusted; ambiguous restoration fails the build.

## Private market source map

```bash
npm run data:source-map:template
```

The completed `.private/market-source-map.json` remains outside version control. Korean entries use private six-digit KRX symbols; U.S. entries use private Nasdaq symbols and `assetClass`. Public runtime files contain masked IDs/aliases only.

## Provider isolation

- Korean production prices: KRX only.
- U.S. production prices: Nasdaq Historical Quotes only.
- Stooq and other third-party feeds: validation-only.
- Bank of Korea ECOS: USD/KRW and base-rate production reference series, not stock prices.
- Corporate actions: separate source-backed events; never substituted by adjusted execution prices.
- News: curated dated information with no-lookahead reveal rules.

Market builders preserve the other market's generated files and manifest entries so a refresh of one provider cannot silently replace the other market.

## Save compatibility

The v0.18.0 integration keeps save schema **v9**. Dividend entitlement reconstruction reuses persisted trade execution history and does not add a new persisted field, so no new save migration is required.

## CI

Release CI starts from the committed npm lockfile with `npm ci`, then runs lint, typecheck, unit tests, `data:check`, strict Korean/U.S./FX/base-rate validation, event/news validation, coverage reporting, production build, and responsive Playwright tests at 320, 360, 390, 768, and 1280 pixel widths.
