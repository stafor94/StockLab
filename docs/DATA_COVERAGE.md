# Historical data coverage

StockLab treats completeness as an explicit build/runtime property. Missing history is never silently filled with fabricated prices, volume, FX, corporate actions, or news.

## Market coverage gates

```bash
npm run data:coverage
npm run data:coverage -- --strict-market
```

Strict market mode requires all 109 catalog assets plus generated Korean and U.S. calendars.

## v0.17.0 production market coverage

| Market | Stocks | ETFs | Total | Production source | Coverage |
| --- | ---: | ---: | ---: | --- | --- |
| Korea | 40 | 12 | 52 | KRX-operated KIND | 2018-01-01 through 2026-08-25 calendar coverage |
| U.S. | 45 | 12 | 57 | Nasdaq Historical Quotes | 2018-01-02 through 2026-08-24 latest completed session |
| Combined | 85 | 24 | 109 | KRX + Nasdaq | 109/109 generated assets |

The U.S. release contains 119,908 daily bars. Five securities begin after the global 2018 start because they were not yet listed. Strict validation reports zero missing trading dates from each asset's first executable bar through the latest generated session.

Two Nasdaq historical rows report unavailable volume. These remain `null`; zero or synthetic volume is not invented.

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

## Corporate-action completeness

Corporate-action source modes remain separate from market-price completeness:

- `empty-seed`: no verified actions loaded;
- `curated-partial`: included events are verified but coverage is not comprehensive;
- `generated`: configured event coverage is comprehensive.

The market being 109/109 complete does not imply dividend/merger/news coverage is complete. Split events used for U.S. price-scale restoration are also represented as separate corporate actions for gameplay.

## Private market source map

```bash
npm run data:source-map:template
```

The completed `.private/market-source-map.json` remains outside version control. Korean entries use private six-digit KRX symbols; U.S. entries use private Nasdaq symbols and `assetClass`. Public runtime files contain masked IDs/aliases only.

## Provider isolation

- Korean production prices: KRX only.
- U.S. production prices: Nasdaq Historical Quotes only.
- Stooq and other third-party feeds: validation-only.
- Bank of Korea ECOS: FX and base-rate reference series, not stock prices.

Market builders preserve the other market's generated files and manifest entries so a refresh of one provider cannot silently replace the other market.

## CI

Release CI runs lint, typecheck, unit tests, `data:check`, `data:kr:check`, `data:us:check`, FX/rate/event/news validation, coverage reporting, production build, and responsive Playwright tests.
