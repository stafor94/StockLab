# Changelog

All notable changes to StockLab are documented in this file.
The project follows Semantic Versioning and the Keep a Changelog structure.

## [Unreleased]

## [0.11.0] - 2026-08-25

### Added
- Pure TypeScript portfolio valuation engine with historically known price selection: previous close during pre-open and current-day open only after market open.
- KRW-equivalent gross assets, net worth, unrealized P&L, realized sell P&L, cumulative trading fees, and valuation-completeness reporting.
- Loan-repayment-neutral strategy return using `gross assets + cumulative principal repaid` against the original KRW 10,000,000 game capital.
- Return-based badge ladder: 회복 모드, 시장 견습생, 초보 투자자, 성장 투자자, 숙련 투자자, 큰손, 시장의 고수, 월가의 전설.
- Responsive portfolio screen with holdings, known valuation-price timestamp/source, performance cards, rank progress, and missing-data warnings.
- Persistent sell cost basis and realized P&L fields for new executions.
- Unit tests for no-lookahead valuation, principal-repayment-neutral return, missing-price handling, badge thresholds, realized P&L, and save migration.
- `docs/PERFORMANCE.md` documenting return, net-worth, valuation, P&L, and badge rules.

### Changed
- Home total-assets, net-worth, and return figures now use the same shared portfolio valuation engine instead of position book value.
- Legacy sell trades keep their original economics and migrate with unknown realized cost basis rather than guessed historical values.
- Save schema advanced from v7 to v8 for trade performance fields.
- App version advanced to `v0.11.0`.

## [0.10.0] - 2026-08-25

### Added
- Versioned historical-news manifest/year schema, cached runtime client, React loading hook, and static CI validator.
- Pure TypeScript no-lookahead news reveal engine for `PRE_OPEN`, `INTRADAY`, and `POST_CLOSE` timing.
- Responsive full news screen with unread state, headline list, detailed game-written article view, related assets/sectors, and reveal metadata.
- Important-news timeline stops with blocking confirmation modal and direct `뉴스 보기` navigation.
- Timeline autoplay with 1×, 2×, 5×, and 10× speeds implemented as UI timing only; game economics still advance through deterministic date operations.
- Automatic autoplay stop on important corporate events, important news, WS Bank payment failure, and game over.
- Empty schema-valid news manifest seed so no fabricated history is shipped before authoritative curation.
- Unit tests for news reveal timing, important-news stop selection, autoplay stop behavior, and save migration.
- `docs/NEWS_SYSTEM.md` documenting curation, copyright-safe article writing, masked identities, and timing rules.

### Changed
- Save schema advanced from v6 to v7 with persisted read-news IDs and pending important-news acknowledgements.
- Home dashboard now includes today's revealed news, a dedicated news route, autoplay speed controls, and explicit stop reasons.
- Time progression context now considers corporate events and important news together before selecting the earliest stop date.
- CI now validates the static news dataset before production build.
- `AGENTS.md` now codifies historical-news sourcing, no-fabrication, no-lookahead, and autoplay architecture rules.
- App version advanced to `v0.10.0`.

## [0.9.0] - 2026-08-25

### Added
- Pure TypeScript corporate-action engine for dividends, stock splits/reverse splits, mergers, listings/delistings, trading halts, and resumptions.
- Versioned corporate-event JSON schema, lazy runtime client, React loading hook, and static CI validator.
- Explicit event timing (`PRE_OPEN`, `INTRADAY`, `POST_CLOSE`) with no-lookahead reveal rules.
- Important-event timeline stopping and blocking confirmation modal designed to pause future autoplay as well as manual multi-day jumps.
- Portfolio effects for net cash dividends, split ratio/average-cost changes, authoritative cash-in-lieu handling, merger exchange/cash consideration, and delisting cash-out when supplied.
- Persistent halted/delisted asset restrictions enforced in both store order validation and responsive trading UI.
- Corporate-event history and pending-important-event queue persisted in save data.
- Empty schema-valid `public/data/events/corporate.json` seed so no fabricated events are shipped before authoritative history is assembled.
- Unit tests for dividend withholding, split accounting, halt/order cancellation, delayed post-close reveal, and delisting cash settlement.
- `docs/CORPORATE_EVENTS.md` documenting timing, processing order, source policy, whole-share rules, and failure-on-missing-authoritative-data behavior.

### Changed
- Date advancement now processes settled sale proceeds → corporate actions → WS Bank loan lifecycle, then enters the destination pre-open state.
- Multi-day progression stops at the first important event reveal date instead of skipping over it.
- Save schema advanced from v5 to v6 with automatic defaults for corporate history, restrictions, and acknowledgement queue.
- Home dashboard now surfaces corporate-event status/history for the current game date.
- CI now validates the corporate-event dataset before production build.
- App version advanced to `v0.9.0`.

## [0.8.0] - 2026-08-25

### Added
- Pure TypeScript date-effective sell-cost engine, separate from UI and market-price loading.
- Korean KOSPI/KOSDAQ securities transaction-tax schedules from 2018 through the current 2026 rules, including the KOSPI 0.15% rural special tax.
- Korean ETF securities-transaction-tax exemption.
- Historical Korean venue classification with the `K017` KOSDAQ-to-KOSPI transfer effective 2018-02-09 and `K037` KOSDAQ classification.
- U.S. Section 31 covered-sale pass-through schedule from 2018 through the 2026 $20.60-per-million rate.
- FINRA equity TAF schedules and per-trade caps from 2018 through 2026, including the low-price exemption rule.
- Persisted trade cost breakdown for commission, transaction tax, rural special tax, Section 31 pass-through, FINRA TAF, and total fees.
- Unit tests for Korean tax effective-date boundaries, ETF exemption, venue transfer, U.S. Section 31 changes, FINRA TAF caps, and sell-settlement net proceeds.
- `docs/TRADING_COSTS.md` with authoritative rule sources, rounding policy, and explicit scope boundaries.

### Changed
- Sell settlement proceeds now use the true net after WS Securities commission plus date-applicable statutory/regulatory costs.
- Save schema advanced from v4 to v5; existing trade history is migrated by adding zero legacy tax/regulatory fields without retroactively rewriting historical saved cash economics.
- Shared currency rounding moved into a dedicated trading utility so broker commission and historical-cost modules use the same money rules.
- Trading UI now states that dated taxes/regulatory costs are deducted before sale proceeds settle.
- App version advanced to `v0.8.0`.

## [0.7.0] - 2026-08-25

### Added
- Bank of Korea base-rate ingestion using ECOS table `722Y001`, item `0101000`, with cached build-time retrieval and runtime validation.
- Verified 2018 bootstrap base-rate seed for the initial game loop; the authoritative ECOS build replaces the bootstrap for full-history play.
- Pure TypeScript WS Bank variable-rate loan engine using `BOK base rate + 3.0%p` and daily interest accrual.
- Monthly interest billing on the first WS Bank business day, full-balance automatic debit, and business-day retry after insufficient funds.
- Overdue pricing using the contract rate plus 3.0%p, capped at 15% annually, applied to unpaid billed interest.
- Three-consecutive-month interest delinquency game-over condition.
- KRW 1,000,000-unit principal prepayment and full payoff that also settles accrued unbilled interest.
- Responsive WS Bank loan screen with balance, rate, next payment date, delinquency status, repayment controls, and loan-event history.
- Game-over screen for three-month delinquency.
- Unit tests for rate lookup, daily accrual, scheduled debit, retry, delinquency game over, principal repayment, ECOS normalization, and save migration.
- `docs/LOAN_RULES.md` documenting rate sources, formulas, settlement ordering, retry behavior, and game-over rules.

### Changed
- Save schema advanced from v3 to v4. Legacy top-level loan fields migrate into a dedicated `loan` account object without losing cash, positions, orders, settlements, trades, or FX history.
- Date advancement now credits due settlements before processing every intermediate loan day so settled proceeds can satisfy a WS Bank retry while unsettled proceeds cannot.
- The asset screen now separates FX and WS Bank loan management behind dedicated responsive tabs.
- CI now validates the BOK base-rate dataset in addition to market and FX datasets.
- App version advanced to `v0.7.0`.

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
