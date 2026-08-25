# Changelog

All notable changes to StockLab are documented in this file.
The project follows Semantic Versioning and the Keep a Changelog structure.

## [Unreleased]

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
