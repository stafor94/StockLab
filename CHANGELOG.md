# Changelog

All notable changes to StockLab are documented in this file.
The project follows Semantic Versioning and the Keep a Changelog structure.

## [Unreleased]

## [0.6.0] - 2026-08-25

### Added
- Bank of Korea ECOS daily USD/KRW ingestion pipeline using build-time credentials and cached raw responses.
- Versioned USD/KRW runtime schema, parser, loader, and static-data validator.
- Pure TypeScript WS Securities FX engine for manual KRW → USD and USD → KRW conversion.
- Representative WS Securities FX policy: 1.00% base spread, 95% preferential discount, 0.05% effective spread.
- Responsive asset/FX screen with KRW and USD balances, reference/applied rates, quote preview, and exchange history.
- Persisted exchange history with deterministic exchange IDs.
- Unit tests for ECOS normalization, FX-date selection, spread calculation, exchange execution, and save migration.
- `docs/FX_DATA.md` documenting source, build, runtime, and game-pricing rules.

### Changed
- Save schema advanced from v2 to v3 with automatic migration; existing positions, pending orders, settlements, and trades are preserved while FX history is initialized.
- CI now validates generated FX data when present while allowing the repository to remain free of fabricated fallback rates.
- App version advanced to `v0.6.0`.

## [0.5.0] - 2026-08-25

### Added
- Pure TypeScript pre-open market-order engine for amount buys, quantity buys, quantity sells, and sell-all orders.
- WS Securities representative online commissions: 0.015% for Korean assets and 0.07% for U.S. assets.
- Same-day actual-open execution with whole-share enforcement and gap-up cancellation for unaffordable quantity buys.
- Amount-buy sizing that purchases the maximum affordable whole-share quantity after the actual open price and commission are known.
- Position tracking with weighted average execution price, trade history, and deterministic order IDs.
- Sell-proceeds settlement queue instead of immediate cash credit.
- Korean T+2 settlement and historical U.S. T+2/T+1 transition effective 2024-05-28.
- Responsive WS Securities order panel, pending-order cancellation, and explicit market-open execution control.
- Save schema v2 with v1-to-v2 migration for positions, orders, settlements, trades, and market-session phase.
- Unit tests for order execution, sell reservation, settlement timing, and save migration.

### Changed
- Advancing the game date now credits due settlements, resets the session to pre-open, and cancels unexecuted same-day orders.
- Home cash cards distinguish settled cash from unsettled sale proceeds.
- App version advanced to `v0.5.0` and save schema advanced to version 2.

## [0.4.0] - 2026-08-25

### Added
- Responsive market browser for masked Korean/U.S. stocks and ETFs with market, ETF, sector, and search filters.
- Asset-detail view with game ID, masked company name, industry, listing visibility date, currency, and raw-price policy.
- Responsive SVG candlestick chart with 1-month, 3-month, 1-year, and full-history ranges.
- Runtime fallback catalog so the market browser remains usable before authoritative price files are generated.
- Explicit listing-date visibility guards for post-2018 assets while the generated manifest is still unavailable.
- Unit tests for asset visibility/filtering and pre-open chart data selection.
- Responsive E2E coverage for opening the market browser and ensuring future-listed assets remain hidden.

### Changed
- Refactored the home dashboard out of `App.tsx`; the app shell now owns only shared navigation and screen selection.
- Price loading can resolve directly from a catalog data path, while still using the generated manifest when available.
- All market chart data is filtered to dates strictly before the current game date during the pre-open phase, preventing same-day OHLC lookahead.
- App version advanced to `v0.4.0`; save schema remains version 1.

## [0.3.0] - 2026-08-25

### Added
- Stable masked asset catalog with 109 planned assets: 40 Korean stocks, 45 U.S. stocks, 12 Korean ETFs, and 12 U.S. ETFs.
- KRX Open API adapters for KOSPI, KOSDAQ, and ETF daily trading data using build-time `AUTH_KEY` authentication.
- Alpha Vantage `TIME_SERIES_DAILY` raw OHLCV adapter with full-history mode and provider error detection.
- Source normalizers that convert authoritative provider payloads into StockLab's unadjusted daily-bar schema.
- Build-time private ticker/source mapping separated from public game metadata.
- Resumable raw-response cache under `.cache/market-data/`.
- Full market-data builder that generates per-asset JSON, KRX/U.S. trading calendars, and the runtime manifest.
- Static dataset validator covering catalog identity, metadata consistency, calendar membership, bar ordering, and OHLC integrity.
- Data pipeline documentation and environment-variable template.
- Unit tests for the masked catalog and provider normalizers.

### Changed
- CI now typechecks build tooling and validates the market-data catalog/static dataset before production build.
- App version advanced to `v0.3.0`; save schema remains version 1.

## [0.2.0] - 2026-08-25

### Added
- Pure TypeScript market-calendar engine for Korean and U.S. trading sessions.
- `+1일`, `+1주`, and `+1개월` game-date progression with joint-market holiday skipping.
- Versioned static market-data manifest, calendar, asset metadata, and unadjusted OHLCV schemas.
- Cached JSON data client with lazy per-asset price loading.
- Runtime validation for external JSON data before it reaches the game engine.
- Bootstrap KRX/U.S. calendar seed covering the first playable period; full historical calendar generation remains a later data-ingestion task.
- Unit tests for calendar progression, schema validation, and lazy data loading.
- Responsive E2E coverage that verifies the first game-date transition on mobile, tablet, and desktop.

### Changed
- Centralized initial game constants instead of duplicating seed-money/date magic values.
- Market dashboard now reports calendar load state and current open-market state.

## [0.1.1] - 2026-08-25

### Fixed
- Corrected the tablet Playwright project to run with Chromium while retaining an iPad-sized viewport.

## [0.1.0] - 2026-08-25

### Added
- React, TypeScript, Vite project foundation for GitHub Pages.
- Mobile-first responsive dashboard shell for phone, tablet, and desktop layouts.
- Single-slot local save foundation using `stocklab.save` and save schema version 1.
- Initial game state: 2018-01-01, KRW 10,000,000 cash, USD 0, WS Bank loan KRW 10,000,000.
- In-app application version and save-schema indicators.
- CI workflow with lint, typecheck, unit tests, production build, and responsive Playwright smoke tests.
- GitHub Pages deployment workflow.
- Initial development and data-source governance in `AGENTS.md`.
