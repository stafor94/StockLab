# Changelog

All notable changes to StockLab are documented in this file.
The project follows Semantic Versioning and the Keep a Changelog structure.

## [Unreleased]

## [0.34.1] - 2026-09-02

### Changed
- Raised the shared phone typography scale below 640px so metadata starts at 13px, secondary/body/control text grows to 14–15px, section/screen titles grow to 22–24px, and Market asset names reach 17px without changing desktop density.
- Rebalanced Home investment labels, market status/index data, holding values, corporate-event copy, and Market filters/search/quote hierarchy while preserving the existing cards, rows, touch targets, and compact information layout.
- Added responsive Playwright coverage and visual QA screenshots for Home and Market at 360px, 390px, 412px, 480px, and 1280px, including horizontal-overflow and same-row regressions.
- App version advanced to `v0.34.1`; save schema remains v13 and trading, settlement, portfolio calculations, market data, corporate actions, FX/rates, loan economics, and market progression are unchanged.

## [0.34.0] - 2026-09-02

### Added
- Added a settings appearance control for switching between white and dark screen modes, with white mode as the default when no preference has been saved.
- The selected appearance is persisted separately in `stocklab.theme` and restored before the React app mounts, without changing the game-save schema.
- Added unit coverage for default, persisted, restored, and settings-dialog theme switching behavior.

### Changed
- Reworked shared color tokens, navigation, settings surfaces, status accents, and browser theme color so both white and dark modes use the same responsive layout with mode-appropriate contrast.
- App version advanced to `v0.34.0`; save schema remains v13 and trading, settlement, portfolio, market data, corporate actions, FX/rates, loan economics, and market progression are unchanged.

## [0.33.1] - 2026-09-01

### Changed
- Reworked historical market-cap build inputs so Korean listed-share history uses official KRX KIND data without requiring a KRX Open API key, while preserving the existing unadjusted KRX/Nasdaq price authorities.
- Added tracked verified SEC shares-outstanding snapshots for supported U.S. stocks; the market-cap builder uses verified snapshots first and falls back to SEC Company Facts only when a tracked snapshot is unavailable.
- Added source-map/private-identity validation and regression coverage for the keyless market-cap and verified SEC snapshot paths.
- App version advanced to `v0.33.1`; save schema remains v13 and trading, settlement, portfolio, corporate-action, price, FX/rate, and market-progression economics are unchanged.


## [0.33.0] - 2026-08-28

### Added
- Added a separate point-in-time market-capitalization pipeline: Korean stocks/ETFs use official KRX OPEN API `MKTCAP`/`LIST_SHRS`, U.S. stocks combine existing unadjusted Nasdaq prices with SEC EDGAR shares outstanding, and U.S. ETFs accept Nasdaq GIDS Total Shares Outstanding as a private authoritative build input.
- Added runtime schema/loading and regression coverage for market-cap values that respect pre-open/open/close information boundaries.

### Changed
- The Market tab ranks visible assets by point-in-time market capitalization when the complete validated market-cap dataset is installed. Mixed Korean/U.S. rankings use the existing Bank of Korea USD/KRW reference rate; unavailable values remain after ranked assets.
- Korean and U.S. authoritative price refresh builders preserve existing `marketCapPath` references.
- App version advanced to `v0.33.0`; save schema remains v13 and trading, settlement, portfolio, corporate-action, price, FX/rate, and market-progression economics are unchanged.

## [0.32.1] - 2026-08-28

### Changed
- On phone portrait viewports below 640px, the Home `보유 종목` summary now shows at most three holding cards in one row; wider tablet and desktop layouts continue to show up to four cards.
- Added responsive Playwright coverage for the three-card portrait cap, single-row alignment, landscape restoration, and horizontal-overflow safety.
- App version advanced to `v0.32.1`; save schema remains v13 and portfolio valuation, trading, settlement, market data, corporate actions, FX/rates, market progression, and existing valid saves are unchanged.

## [0.32.0] - 2026-08-28

### Added
- Home `보유 종목` summary cards now open the existing shared buy/sell trading dialog directly without navigating away from Home.
- Added responsive Playwright regression coverage that verifies a Home holding remains on the Home tab while opening and closing the shared trading dialog.

### Changed
- Home order entry reuses the existing `TradingDialog` / `TradingPanel`, current market-session state, official price loading, and settlement-calendar rules instead of adding a separate Home trading path.
- App version advanced to `v0.32.0`; save schema remains v13 and market data, raw/unadjusted OHLC, portfolio valuation, trading/settlement economics, corporate actions, FX/rates, market progression, and existing valid saves are unchanged.

## [0.31.1] - 2026-08-28

### Changed
- Compacted Home holding cards so `평가금액` and its value share one row, while return rate and unrealized P&L share one row without repeating visible `수익률` / `손익` labels.
- The Home major-index summary now hides Dow Jones while no official DJIA history is available and lets the remaining three supported index cards use the available row width.
- Added responsive Playwright regression coverage for the compact holding-card rows, hidden unavailable Dow card, three-index spacing, and horizontal-overflow safety.
- App version advanced to `v0.31.1`; save schema remains v13 and market data, raw/unadjusted OHLC, portfolio valuation, trading/settlement rules, corporate actions, FX/rates, market progression, and existing valid saves are unchanged.

## [0.31.0] - 2026-08-28

### Added
- Added a compact Home `보유 종목` summary that reuses the existing no-lookahead portfolio valuation snapshot, ranks positive-quantity positions by KRW-equivalent market value, and shows up to four holdings with valuation, quantity, unrealized P&L, and return rate.
- Added unit coverage for top-holding selection plus responsive Playwright regressions for the Home holdings empty state/navigation, removed Home news feed, index spacing, and Dow availability copy across the configured mobile, tablet, and desktop viewports.

### Changed
- Removed the Home-only `오늘의 뉴스` section while preserving the News tab, news list/detail behavior, important-news interruption flow, and underlying historical-news processing.
- Added horizontal breathing room to the four major-index cards and allows compact phones to scroll the index strip instead of compressing cards below their readable width.
- Clarified the Dow Jones card as currently unavailable under the configured official-source policy; no proxy, third-party series, market data, or pricing rules were introduced.
- App version advanced to `v0.31.0`; save schema remains v13 and market data, raw/unadjusted OHLC, trading/settlement rules, corporate actions, FX/rates, market progression, and existing valid saves are unchanged.

## [0.30.0] - 2026-08-28

### Changed
- Simplified the Home investment loan summary to show the outstanding principal without the secondary interest-rate and next-payment subtitle.
- Reworked the Assets overview so cash, pending settlement, and WS Bank loan balances remain in one compact horizontal row on mobile as well as larger viewports.
- Loan history now hides billing-only `interest_due` entries, shows the five most recent meaningful events by default, and reveals five additional events per `더보기` action.
- Added responsive Playwright regression coverage for the compact asset summary, hidden Home loan subtitle, filtered loan history, five-item paging, touch-target sizing, and horizontal-overflow safety.
- App version advanced to `v0.30.0`; save schema remains v13 and loan economics, market data, raw/unadjusted OHLC, trading/settlement rules, corporate actions, FX/rates, and existing valid saves are unchanged.

## [0.29.0] - 2026-08-28

### Changed
- Simplified the shared header date, Help, and Settings controls to text/icon-only presentation without persistent card backgrounds or borders, while keeping their existing 44px touch targets and keyboard focus indication.
- Removed the visible `현재 날짜` label from the header date control while preserving the date/time display, accessible label, and market-calendar action.
- Reworked the News screen into a single-column accordion: selecting an item expands its detail content directly beneath that list item, selecting another item closes the previous one, and selecting the open item again collapses it.
- Added responsive Playwright regressions for the plain header controls and exclusive news expand/collapse behavior, and aligned typography coverage with the removed header label.
- App version advanced to `v0.29.0`; save schema remains v13 and market data, raw/unadjusted OHLC, trading/settlement rules, corporate actions, FX/rates economics, and existing valid saves are unchanged.

## [0.28.2] - 2026-08-28

### Changed
- Introduced a shared readable typography scale and raised primary user-facing text across the shared shell, home, market, portfolio, exchange, and asset-management screens while preserving the existing information architecture and responsive behavior.
- Reworked compact 320–359px rules to keep user-facing text at 12px or larger, using spacing, grid sizing, and letter-spacing adjustments instead of shrinking key labels and market-index data into 7–10px ranges.
- Expanded responsive Playwright coverage to 412px and added explicit minimum-font-size and horizontal-overflow regressions across the configured mobile, tablet, and desktop viewports.
- App version advanced to `v0.28.2`; save schema remains v13 and game calculations, market data, raw/unadjusted OHLC, trading/settlement rules, corporate actions, FX/rates economics, and existing valid saves are unchanged.

## [0.28.1] - 2026-08-28

### Fixed
- Removed the persistent bottom-navigation completion check that remained on the Market tab after navigation because first-run guidance completion state was being rendered like an active-tab indicator.
- Replaced KRX holiday inference from price-date gaps with explicit verified KRX closure metadata, including named holidays, election/temporary holidays, year-end closures, and weekend-plus-holiday preservation in the market calendar.
- Strengthened Korean calendar validation so any covered weekday that is neither an official trading date nor an explicit KRX closure, or any closure that collides with a trading date, fails CI; this also caught and added the omitted 2025-06-03 presidential-election closure.

### Changed
- Added a release-metadata guard to both CI and GitHub Pages deployment so every change targeting `main` must advance the canonical app version and include the matching dated changelog release section before it can pass or deploy.
- Updated `AGENTS.md` to make the existing production-deploy/version relationship explicit and prevent release metadata from being deferred to a follow-up change.
- App version advanced to `v0.28.1`; save schema remains v13 and market-price OHLC, corporate-action processing, trading/settlement economics, FX, rates, and existing valid saves are unchanged.

## [0.28.0] - 2026-08-27

### Added
- Added per-asset favorites in the Market list, with dedicated star controls and a favorites-only filter that composes with the existing market, search, and sector filters.
- Favorite asset IDs now persist in the existing local save and survive reloads and game resets; existing saves migrate to save schema v13 with an empty favorites list when needed.
- Added unit and responsive E2E coverage for favorite toggling, filtering, persistence, save migration/reset behavior, and the shared sticky header.

### Changed
- The shared StockLab/version/current-date/help/settings header now remains pinned at the top while scrolling across Home, Market, Portfolio, News, and Assets.
- App version advanced to `v0.28.0`; save schema advanced to v13 solely for favorite asset IDs. Market-price data, raw/unadjusted OHLC, trading/settlement rules, corporate actions, FX, rates, loan economics, and existing valid saves are otherwise unchanged.

## [0.27.0] - 2026-08-27

### Added
- The floating game-progress control is now available on Home, Market, Portfolio, News, and Assets instead of being limited to the home dashboard.
- Added responsive E2E coverage that verifies the shared progress trigger remains available across all five primary tabs while autoplay continues advancing the game clock.

### Changed
- Autoplay now remains active while navigating between tabs because the shared progress controller follows the app-shell lifecycle instead of the home-screen lifecycle.
- Game reset still stops autoplay, restores 1× speed, clears progress UI state, and returns to the initial 2018-01-01 clock.
- App version advanced to `v0.27.0`; save schema remains v12 and market data, raw/unadjusted OHLC, trading, settlement, corporate-action calculations, FX, rates, loan economics, and existing valid saves are unchanged.

## [0.26.0] - 2026-08-27

### Added
- Added a 30× autoplay speed while keeping speed selection as UI timing only; deterministic market-event ordering and game economics are unchanged.
- Added non-blocking autoplay toast notifications for important news and corporate events. Toasts remain visible for about 3 seconds, show at most 3 simultaneously, and queue additional notices until a visible slot opens.
- Added a dedicated WS Bank automatic-payment-failure warning dialog that stops autoplay and surfaces the failed debit date, amount, and consecutive missed-month count.
- Added unit and responsive E2E coverage for 30× timing, the three-toast visibility limit and queue rotation, autoplay continuation through important news, and forced stop on a loan payment failure.

### Changed
- Important news and corporate events continue to use the existing blocking confirmation flow during manual progression, but during autoplay they are acknowledged through toast notifications without interrupting progression. Loan payment failures and game-over conditions remain blocking autoplay stops.
- Updated the autoplay help and development rules to match the new manual-versus-autoplay interruption policy.
- App version advanced to `v0.26.0`; save schema remains v12 and market data, raw/unadjusted OHLC, trading, settlement, corporate-action calculations, FX, rates, loan economics, and existing valid saves are unchanged.

## [0.25.0] - 2026-08-27

### Added
- The header `현재 날짜` control now opens a responsive market calendar centered on the current game month, with previous/next-month navigation and a one-tap return to the current game date.
- Calendar days mark KRX closures, U.S. market closures, and weekends separately, and selecting a date shows the existing calendar dataset's closure reason without introducing a second holiday source.
- Added responsive Playwright coverage for opening/closing the calendar, distinct Korean/U.S. closure markers and reasons, current-date highlighting, month-specific holiday selection, and compact-viewport overflow safety.

### Changed
- The market calendar reuses the existing lazily loaded KRX/U.S. calendar data and does not alter market-session progression, trading dates, raw/unadjusted OHLC, execution rules, corporate actions, FX, rates, or save data.
- App version advanced to `v0.25.0`; save schema remains v12 and existing valid saves are unchanged.

## [0.24.6] - 2026-08-27

### Fixed
- A failed WS Bank automatic interest payment no longer replaces the home `다음 시장 이벤트` action with a cash/loan review action, so the next KRX or U.S. market open/close remains directly available.
- Loan payment failures continue to surface through the existing red `자산` navigation badge without changing market-session progression rules.

### Changed
- The home investment summary now keeps total assets, net assets, cash, and loan information in one horizontal row and removes the redundant `원화` / `달러` labels from the cash column.
- KOSPI, KOSDAQ, Nasdaq Composite, and Dow Jones cards now remain in one four-column row from 320px phones through desktop, with tighter mobile spacing and typography.
- Added unit and responsive E2E regressions for the loan-guidance priority, four-column investment summary, removed cash labels, one-row market indices, and horizontal-overflow safety.
- App version advanced to `v0.24.6`; save schema remains v12 and loan economics, market timelines, market-price data, raw/unadjusted OHLC, trading/settlement rules, corporate actions, FX, rates, and existing valid saves are unchanged.

## [0.24.5] - 2026-08-27

### Changed
- Selecting a stock or ETF now shows the existing no-lookahead candlestick chart and range controls inside the shared trading dialog, above the buy/sell direction selector.
- Choosing buy or sell hides the chart and shows only the focused order controls, while the redundant inline market detail/chart area has been removed so the market list uses the available width.
- Added responsive E2E coverage for chart placement, no-lookahead empty-chart states, dialog overflow, and the transition between chart/side selection and focused order entry.
- App version advanced to `v0.24.5`; save schema remains v12 and market-price sources, raw/unadjusted OHLC, execution and settlement rules, corporate actions, FX, rates, and existing valid saves are unchanged.

## [0.24.4] - 2026-08-27

### Removed
- Removed the home `첫 게임 추천` checklist panel so the bottom of the home dashboard no longer shows the redundant first-game recommendation block.

### Changed
- Added responsive E2E regression coverage that keeps the removed recommendation panel absent even when an older save still contains incomplete checklist state.
- App version advanced to `v0.24.4`; the first-run tutorial, `다음 행동` guidance, navigation attention state, save schema v12, market data, trading rules, FX, rates, corporate actions, and existing valid saves are unchanged.

## [0.24.3] - 2026-08-27

### Changed
- Manual KRW/USD exchange is now available regardless of KRX or U.S. market session state.
- The existing 95% FX preference now applies only while the Korean market session is open; all other times use the 1.00% base spread, including when only the U.S. market is open.
- Exchange UI, help text, FX documentation, unit tests, and responsive E2E coverage now reflect the always-available exchange rule and time-limited preference.
- App version advanced to `v0.24.3`; save schema remains v12 and market-price data, raw/unadjusted OHLC, corporate actions, settlement rules, and existing valid saves are unchanged.

## [0.24.2] - 2026-08-27

### Fixed
- Game reset now refreshes the mounted game screen as well as persisted game state, clearing stale timeline/date messaging and autoplay UI state before returning to the initial 2018-01-01 game clock.
- Settings reset and game-over restart now share the same UI reset path, return navigation and page scroll to the home starting position, and keep the existing completed/skipped tutorial preference behavior.

### Changed
- App version advanced to `v0.24.2`; save schema remains v12 and market data, raw/unadjusted OHLC, corporate actions, trading economics, FX, rates, and existing valid saves are unchanged.

## [0.24.1] - 2026-08-27

### Fixed
- Recovered migrated independent-market saves whose persisted session phase can lag behind the shared game timestamp, preventing a U.S. close from being offered while that same trading date is still marked pre-open.
- When a matching OPEN event was skipped in saved state, StockLab now replays the normal market-open path without moving the already-reached game clock backward, then allows the normal CLOSE event on the next progression action.

### Changed
- App version advanced to `v0.24.1`; save schema remains v12 and market-price sources, raw/unadjusted OHLC, corporate actions, fees, taxes, settlement, FX, rates, and existing valid save data are unchanged.

## [0.24.0] - 2026-08-27

### Added
- Added one shared timestamp-based game clock with independent KRX and U.S. regular-session OPEN/CLOSE events, market-specific holiday skipping, `America/New_York` timezone/DST conversion, and KST date/weekday/time presentation.
- Added regression coverage for normal market-event order, DST and non-DST U.S. sessions, one-market and joint closures, weekend skips, KST midnight boundaries, close-minus-one-minute presentation, market-specific quotes/indices/orders, save migration, and week/month fast-forward including corporate actions.

### Changed
- KRX and U.S. markets now persist independent trading dates and session/price state. Only assets in the currently opened market can trade at that market's actual unadjusted open; CLOSE reveals the completed official daily OHLC/close for quotes and valuation but no longer permits new immediate orders.
- `+1주` remains +7 calendar days and `+1개월` remains +1 calendar month while the game fast-forwards the intervening market-event sequence and existing settlement, corporate-action, news, and loan processors without inventing premarket/after-hours prices or automatic trades.
- The header current-date treatment now shows the game date, weekday, and KST game time with stronger visual hierarchy. CLOSE events display KRX 15:29 or U.S. local 15:59 converted to KST for presentation while official Close data keeps its normal daily-bar meaning.
- Help, tutorial, market-session documentation, market status, portfolio valuation, and major-index cards now follow the independent-market timeline instead of one global `장 시작 → 장 마감` state.
- Save schema advanced to v12 with migration from the legacy global session state; existing cash, positions, orders, settlements, trades, corporate/news progress, loan state, and other valid save data are retained.
- App version advanced to `v0.24.0`; KRX/Nasdaq OHLC source pipelines and corporate-action source data are unchanged.

## [0.23.0] - 2026-08-27

### Added
- Added KOSPI, KOSDAQ, Nasdaq Composite, and an explicit Dow Jones official-source status card to the home `오늘의 시장` summary, with signed point and percentage changes using the existing red gain / blue loss tokens.
- Added committed official major-index histories, strict schema/calendar coverage validation, source-specific ingestion, runtime loading, pure no-lookahead quote selection, unit coverage, and responsive E2E regressions.

### Changed
- Major-index values now follow the persisted game session phase: latest completed close before market open, actual opening index after `장 시작`, and actual closing index after `장 마감`; closed-market dates stay on the latest completed close without reading future bars.
- Korean index history uses official KRX Indices data and Nasdaq Composite uses Nasdaq Historical Quotes. Dow Jones remains an explicit unsupported-source card rather than mixing a proxy or third-party series.
- App version advanced to `v0.23.0`; save schema remains v11 and tradable asset OHLC, order execution, portfolio valuation, settlement, FX, corporate actions, and existing saves are unchanged.

## [0.22.0] - 2026-08-26

### Added
- Added a second same-day trading window after market close: opened sessions execute at the actual unadjusted open, and closed sessions execute at the actual unadjusted close.
- Added pure trading-engine and responsive E2E regressions for close-price buy/sell execution while preserving the existing fee, tax, settlement, and no-lookahead rules.

### Changed
- Market, portfolio, order, help, and tutorial flows now communicate `장 시작 → 시가 주문 → 장 마감 → 종가 주문`, and the shared order dialog dynamically previews and executes at the phase-appropriate actual price.
- App version advanced to `v0.22.0`; save schema remains v11 and market-data sources, raw/unadjusted OHLC, corporate actions, FX, rates, and existing save data are unchanged.

## [0.21.1] - 2026-08-26

### Added
- Added responsive E2E minimum-font-size coverage for the order direction selector and focused buy-order controls while retaining the existing compact-fit, clipping, and overflow regressions.

### Changed
- Enlarged trading-dialog typography across the direction selector and focused buy-order screens, with stronger increases for mobile metadata, broker/cash information, price/holding values, mode controls, form labels, inputs, quick actions, order previews, and submit actions.
- App version advanced to `v0.21.1`; the compact no-scroll order layout, save schema v11, market data, raw/unadjusted execution prices, trading-engine calculations, fees, taxes, settlement, corporate actions, FX, rates, and save-state rules are unchanged.

## [0.21.0] - 2026-08-26

### Added
- Added a two-step shared order flow: each order dialog now starts with dedicated buy and sell direction actions, then opens a focused screen containing only the selected side's order controls.
- Added responsive and shared-dialog E2E coverage for the direction-selection screen, buy/sell color contrast, back navigation, focused control visibility, compact fit, and both market and portfolio entry paths.

### Changed
- Buy and sell direction actions are now always visibly red and blue with white text using the existing gain/loss palette, instead of coloring only the currently active tab.
- Focused buy and sell screens hide the opposite-side switcher, retain a compact back control to return to direction selection, and keep the selected side visible in the dialog metadata; trading calculations and execution rules are unchanged.
- App version advanced to `v0.21.0`; save schema remains v11 and market data, raw/unadjusted execution prices, trading-engine calculations, fees, taxes, settlement, corporate actions, FX, rates, and save-state rules are unchanged.

## [0.20.10] - 2026-08-26

### Added
- Added a one-character backspace control to buy and sell quantity shortcuts, backed by a shared pure string-input helper and regression coverage for repeated deletion and empty input.
- Added responsive regression coverage across the configured 320×800, 360×800, 390×844, 768×1024, and 1280×800 viewports for shortcut counts, equal-width single-row layout, clipping, horizontal overflow, title fit, and submit-button reachability.

### Changed
- Active buy and sell tabs now use accessible red and blue backgrounds derived from the existing gain/loss palette with white text, while inactive controls retain the existing dark treatment.
- Trading-dialog typography is modestly enlarged while keeping the compact mobile layout, and buy/sell quantity shortcuts remain five/four equal-width controls on one row.
- App version advanced to `v0.20.10`; save schema remains v11 and market data, raw/unadjusted execution prices, trading-engine calculations, fees, taxes, settlement, corporate actions, FX, rates, and save-state rules are unchanged.

## [0.20.9] - 2026-08-26

### Added
- Added a shared pure money-formatting utility with unit and responsive regressions for Korean won suffix formatting while preserving dollar-prefixed USD displays.

### Changed
- Portfolio holding rows now keep only market value and unrealized profit/rate on the right, remove the date/price-source and `눌러서 주문` helper rows, and enlarge the two remaining value lines while preserving full-row order entry.
- Player-facing KRW monetary displays now use Korean suffix form such as `10,000원` instead of a prefixed won symbol across home, market, portfolio, trading, FX, loan, asset-management, and game-over surfaces; USD remains `$`-prefixed.
- Reduced the trading-dialog backdrop to `blur(2px)` with a `0.4` overlay so the underlying screen remains more visible.
- App version advanced to `v0.20.9`; save schema remains v11 and market data, raw/unadjusted execution prices, fees, taxes, settlement, corporate actions, FX economics, rates, and save-state rules are unchanged.

### Fixed
- Loan full-payoff history notes now use the same won-suffix convention as the rest of the UI.

## [0.20.8] - 2026-08-26

### Added
- Portfolio holding rows now show each position's persisted weighted average purchase price alongside the asset ID and held quantity.
- Added component regression coverage for average-price rendering and responsive order-dialog coverage for the expanded title area and softened backdrop.

### Changed
- Reduced the order-dialog backdrop opacity and blur so the underlying screen remains more recognizable while the modal stays visually separated.
- Mobile order-dialog headers now give the order title the full available width and place asset metadata beneath it, preventing the previous 58% title-width cap from truncating longer names.
- App version advanced to `v0.20.8`; save schema remains v11 and market data, raw/unadjusted execution prices, fees, taxes, settlement, corporate actions, FX, rates, and save-state rules are unchanged.

## [0.20.7] - 2026-08-26
### Changed
- Compacted the phone trading dialog so the title metadata, broker/cash summary, pre-open start action, order controls, quantity shortcuts, preview totals, and submit action use substantially less vertical space while preserving the existing order workflow.
- Mobile order labels and values now stay on one line where practical, quick quantity actions stay in one row, and buy previews use a four-column summary on 360px-and-wider phones with a two-column fallback at 320px.
- App version advanced to `v0.20.7`; save schema remains v11 and market data, raw/unadjusted execution prices, fees, taxes, settlement, corporate actions, FX, rates, and save-state rules are unchanged.

### Fixed
- Removed duplicated pre-open explanatory text from the compact dialog presentation and expanded the phone dialog height allowance so the default order form is visible without internal scrolling on supported mobile viewports.

### Added
- Added responsive Playwright regression coverage at 320px, 360px, and 390px widths that verifies the pre-open trading dialog fits without internal scrolling and keeps compact shortcut/preview rows aligned.

## [0.20.6] - 2026-08-26

### Fixed
- Removed the rectangular guidance-recommendation box shadow from bottom navigation tabs, which could leave a blue border around `홈` while another screen was active.
- Added responsive touch E2E coverage that asserts a recommended inactive `홈` tab has no box shadow, border, or pointer-focus outline after navigation.

### Changed
- App version advanced to `v0.20.6`; save schema remains v11 and market data, trading, settlement, corporate-action, FX, rate, and save-state rules are unchanged.

## [0.20.5] - 2026-08-26

### Added
- Added per-asset market-list quotes showing the currently known phase-safe price and previous-close percentage change, with gains in red, losses in blue, and neutral unchanged/unavailable states.
- Added pure quote-selection regressions plus responsive E2E coverage against real KRX raw/unadjusted 2018 prices for both rising and falling assets.

### Changed
- Market list and asset detail now share one no-lookahead quote selector: pre-open uses the latest completed close, opened sessions use only today's actual open, and closed sessions use today's close; non-trading assets fall back to their latest completed close.
- Market-list quote files load progressively in bounded batches while reusing the existing market-data cache.
- App version advanced to `v0.20.5`; save schema remains v11 and market-data sources, raw/unadjusted OHLC, execution-price, fee/tax, settlement, corporate-action, FX, rate, and save-state rules are unchanged.

## [0.20.4] - 2026-08-26

### Added
- Added a shared accessible order-trading dialog that reuses the existing WS Securities order panel, price loading, execution engine, and custom order-error dialog across market and portfolio entry points.
- Tradable portfolio holdings now act as full-row order buttons while the current session is opened, today's actual open is known for that asset, and no halt/delisting restriction is active; portfolio entry defaults to the sell tab.
- Added component and responsive E2E coverage for market-to-dialog ordering, nested order-error dismissal, and portfolio-to-dialog sell entry.

### Changed
- Selecting a stock or ETF in the market screen now opens the order dialog immediately instead of scrolling to an inline order panel below the selected-asset information; asset detail remains focused on price metadata and charting.
- Market order entry defaults to buy while portfolio holding entry defaults to sell, with both routes retaining the same buy/sell tabs, previews, fees, taxes, settlement rules, and actual raw/unadjusted open-price execution.
- App version advanced to `v0.20.4`; save schema remains v11 and market data, execution prices, order economics, settlement, corporate actions, FX, rates, and existing valid saves are unchanged.

### Fixed
- Nested order-error keyboard events no longer bubble into the parent trading dialog, so dismissing an order error with Escape leaves the trading dialog open.

## [0.20.3] - 2026-08-26

### Added
- Added an accessible custom order-error dialog with focus trapping, Escape/backdrop dismissal, explicit confirmation, and responsive mobile/desktop presentation.
- Added component and responsive E2E regression coverage for failed buy orders opening the dialog instead of rendering a small inline error.

### Changed
- Failed buy/sell execution results such as insufficient cash or other order validation errors now open the custom error dialog; successful executions continue to use the compact inline confirmation message.
- App version advanced to `v0.20.3`; save schema remains v11 and market-price, fee, tax, settlement, and order-execution rules are unchanged.

## [0.20.2] - 2026-08-26

### Changed
- Asset-tab loan payment-failure attention is now tracked as persisted unread UI state, separate from the underlying WS Bank overdue status and loan history.
- Save schema advanced to v11 with automatic migration from v10; existing saves initialize loan-payment alert acknowledgements without changing game progress.
- App version advanced to `v0.20.2`; market-data, execution-price, settlement, and loan-economics rules are unchanged.

### Fixed
- Opening the `자산` screen now clears the red loan-payment-failure badge after the player has seen it. Later payment failures appear again only as new unread alerts.
- Added selector, store integration, save-migration, and responsive E2E regression coverage for badge acknowledgement without mutating the loan state.

## [0.20.1] - 2026-08-26

### Added
- Added a settings gear beside Help and an accessible settings dialog with a two-step confirmation for restarting the current game from the initial state.
- Added unit and responsive E2E coverage for settings/reset behavior and Android-style retained navigation focus.

### Changed
- Game reset returns the game date, cash, holdings, orders, settlements, trades, FX history, loan state, corporate/news progress, and current navigation to the initial game state while preserving an already completed or skipped tutorial preference.
- App version advanced to `v0.20.1`; save schema remains v10 and no historical market-data or execution-price rules changed.

### Fixed
- Bottom navigation no longer relies on mobile-browser `:focus-visible` heuristics. Touch/pointer modality suppresses stale blue outlines even when Android retains or restores focus on `홈`, while keyboard navigation keeps an explicit focus indicator.

## [0.20.0] - 2026-08-26

### Added
- Open-price order previews show the exact share count, gross amount, WS Securities commission, total buy cash required, sell fees/taxes, and expected settlement proceeds before submission.
- Quick quantity controls add `+1`, `+10`, `+100`, and maximum affordable shares for buys, plus `25%`, `50%`, and full-position shortcuts for sells.
- Pure TypeScript and responsive E2E regressions cover immediate opened-session execution and the 100-share cost preview.

### Changed
- Trading-day flow is now `장 시작 → 실제 시가 공개 → 시가로 매수·매도 → 장 마감`; new UI orders are no longer entered before the open.
- During the opened phase, buy and sell orders execute immediately at that day's actual raw/unadjusted open while high, low, and close remain hidden until market close.
- The order ticket now appears directly below selected-asset information instead of below the chart, with clearer cash, holdings, and execution-price context.
- Market, home, first-game checklist, and guidance copy now follow the open-then-trade sequence.
- Legacy pre-open pending orders from older saves remain compatible and execute once at market open; save schema remains v10.
- App version advanced to `v0.20.0`.

### Fixed
- Entering a quantity such as 100 shares now immediately shows how much the purchase costs including commission before the user submits it.

## [0.19.2] - 2026-08-26
### Changed
- Market asset rows now make the order path explicit, compact phone/tablet layouts scroll to the selected asset detail, and asset detail provides a direct `매수·매도 주문` shortcut to the WS Securities order panel.
- App version advanced to `v0.19.2`; save schema remains v10 and trading/data calculation rules are unchanged.

### Fixed
- Cleared stale bottom-navigation pointer focus after touch or mouse input so a focus outline no longer remains around `홈` after navigating elsewhere, while preserving keyboard focus visibility.
- Added unit and responsive touch E2E regressions for navigation focus cleanup and compact market-to-order discovery.

## [0.19.1] - 2026-08-26

### Changed
- Rebalanced the home investment summary so total assets remain the primary figure without visually overpowering net assets and KRW/USD cash.
- Increased net-assets and cash typography while preserving the single-row summary and 320px responsive fit.
- Renamed the upper-right `게임 날짜` label to `현재 날짜` while keeping the historical simulation date value unchanged.
- App version advanced to `v0.19.1`; save schema remains v10 and game/data calculation rules are unchanged.

## [0.19.0] - 2026-08-26

### Added
- Optional accessible first-run tutorial with persisted completion/skip state and tutorial replay from the help center.
- First-game checklist, recommended navigation state, attention badges, and structured next-action guidance with real navigation/recovery targets.
- Local-only onboarding QA events and expanded responsive E2E coverage for guidance, tutorial, modal focus behavior, and the compact home summary.

### Changed
- Save schema advanced to v10 with guidance-state migration, including compatibility with parallel preview save shapes.
- Shared modal behavior now provides focus trapping, Escape dismissal, and focus return; manual no-order sessions use a one-time confirmation without blocking autoplay.
- Home investment summary now places total assets, net assets, and KRW/USD cash in one horizontal row instead of rendering cash as a separate section.
- Net-assets typography is smaller and the three-column summary uses tighter responsive spacing down to 320px while preserving unsettled-cash details.
- App version advanced to `v0.19.0`; game/data calculation rules are unchanged.

## [0.18.0] - 2026-08-26

### Added
- Official Bank of Korea ECOS USD/KRW production history with 2,130 official observations from 2017-12-29 through 2026-08-25, preserving latest-known lookup on non-publication days without synthetic rows.
- Official Bank of Korea ECOS base-rate effective history for the full game period with 21 rows including the 2017-11-30 carry-in.
- Curated historical news for 2019 through 2026, bringing 2018-2026 coverage to 80 items with dated no-lookahead reveal rules.
- Expanded source-backed corporate actions to 62 `curated-partial` events: 34 dividends, 12 splits, 14 listings, 1 halt, and 1 resume.
- Dividend entitlement reconstruction from persisted trade executions, including pre-ex-date split replay and payment-date cash handling.
- Year-by-year historical-news lazy loading with request caching and target-year preload before manual or autoplay date advancement.

### Changed
- Production `data:fx:check` and `data:rates:check` are strict; missing/bootstrap production files are not accepted by these commands.
- Corporate-event validation cross-checks every U.S. gameplay split against the verified Nasdaq raw-price restoration table and requires every restoration split to have exactly one matching gameplay event.
- Historical news and corporate-event static validation/coverage reporting now reflect the expanded integrated datasets.
- Timeline progression serializes news preloads and preserves same-date corporate/news/loan processing without duplicate event application.
- CI now uses the committed npm lockfile with `npm ci` and retains responsive Playwright coverage at 320, 360, 390, 768, and 1280 pixel widths.
- App version advanced to `v0.18.0`; save schema remains v9.

### Fixed
- Fixed PR #29 TypeScript compilation by removing Node-only `node:fs/promises` and `node:url` imports from a browser-typed `src/` regression test while preserving lazy runtime loading.
- Added synchronous timeline in-flight guarding so rapid manual input cannot start duplicate year-preload/date-advance operations.
- Strengthened fast-autoplay, news preload cache/retry, same-day important-event, and dividend payment/withholding regressions.

### Data policy
- Korean production execution prices remain official KRX raw/unadjusted OHLCV; U.S. production execution prices remain Nasdaq Historical Quotes restored to historical raw/unadjusted scale only from verified split ratios.
- Dividends, splits, listings, halts, and other corporate actions remain separate gameplay events and never rewrite execution OHLC.
- FX, base rates, news, and corporate actions preserve no-lookahead semantics; future observations or events are never applied early.
- Corporate-action coverage remains explicitly `curated-partial`; v0.18.0 expands coverage but does not claim comprehensive corporate-action completeness for all 109 assets.

## [0.17.0] - 2026-08-26

### Added
- Official Nasdaq Historical Quotes production history for all 45 masked U.S. stocks and 12 masked U.S. ETFs: 57 assets and 119,908 daily bars from 2018-01-02 through the latest completed session available to the build, 2026-08-24.
- Strict `data:us:check` validation for full 57-asset coverage, calendar/listing boundaries, split state, missing trading dates, unavailable volume, and unexplained price-scale discontinuities.
- Verified U.S. split restoration and separate corporate-action events: 11 dated split events across 9 catalog assets, with regression coverage for masked U007, U009, U001, U032, and paired U.S. share-class split cases.

### Changed
- U.S. production price authority is Nasdaq Historical Quotes; Stooq and other third-party feeds are verification-only and are never mixed into production KRX/Nasdaq price files.
- Full production market coverage is now 109/109 assets: 52 official KRX KIND assets plus 57 Nasdaq assets.
- Nasdaq-reported unavailable historical volume is preserved as `null` rather than fabricated; the generated release contains 2 unavailable-volume bars.
- Five U.S. securities begin after the global 2018 start at their first actual executable history rather than receiving invented pre-listing rows.
- CI now enforces both strict Korean and strict U.S. dataset checks before build and responsive Playwright E2E.
- App version advanced to `v0.17.0`; save schema remains v9 and no game calculation or DOM behavior was changed by the data release.


## [0.16.0] - 2026-08-26

### Added
- Complete official KRX KIND historical OHLCV for all 40 masked Korean stocks and 12 masked Korean ETFs, covering the game period from 2018 through 2026.
- Dedicated KRX KIND issuer lookup/session provider, yearly cached history builder, and strict `data:kr:check` validation for all 52 Korean assets.
- Private 52-asset KRX source-map handling with short-code, issuer-code, ISIN, and optional expected-name verification while keeping real identities out of committed public data.
- Regression coverage for Samsung Electronics' 2018 50:1 stock split using actual pre-split and post-split raw prices, plus zero-volume trading-halt row exclusion.
- Manual Korean-history refresh workflow that generates only masked public data and cleans private source material after execution.

### Changed
- Korean production execution prices now use KRX-operated KIND raw/unadjusted historical OHLCV and generated KRX trading-calendar data.
- Retired the mixed KRX Open API / Alpha Vantage market builder and isolated Korean ingestion from the U.S. source path; the repository's existing Stooq U.S. authority remains unchanged.
- Historical market coverage advances to 52/109 assets with all Korean catalog assets populated; U.S. history remains independently incomplete.
- App version advanced to `v0.16.0`; save schema remains v9 and game calculation rules are unchanged.

## [0.15.2] - 2026-08-25

### Removed
- Removed the v0.15.0 Nasdaq Historical Quotes production ingestion, generated 57-asset U.S. dataset, Nasdaq-specific split restoration, and U.S. validation path because StockLab's fixed U.S. market-data authority is Stooq.
- Removed Nasdaq-derived U.S. corporate split events from the committed curated event file; U.S. corporate actions will be reintroduced only when independently source-backed under the production data policy.

### Changed
- Restored the pre-v0.15.0 bootstrap U.S. manifest/calendar state rather than silently mixing or retaining data from an unauthorized provider.
- Preserved all v0.15.1 compact home asset-summary UI changes and save schema v9.
- App version advanced to `v0.15.2`.

## [0.15.1] - 2026-08-25

### Added
- Responsive Playwright coverage that verifies the compact total-assets headline stays within 36px and the net-assets summary remains positioned beside it without horizontal overflow.

### Changed
- Reduced the home total-assets headline one more step and moved net assets from a separate divider row into the available space to the right of total assets.
- Removed the now-redundant standalone net-assets row, further reducing the initial home-screen vertical footprint.
- App version advanced to `v0.15.1`; save schema remains v9 and game/data calculation rules are unchanged.

## [0.15.0] - 2026-08-25

### Added
- Official Nasdaq Historical Quotes ingestion for all 45 U.S. stocks and 12 U.S. ETFs in the masked catalog.
- Strict U.S. historical-data validator covering all 57 U.S. assets, generated calendar membership, listing boundaries, split state, and unexplained price-scale discontinuities.
- Verified dated U.S. split history with automatic detection of Nasdaq split-adjusted rows and restoration to the historical unadjusted execution-price scale.
- Dedicated `data:us:build` and `data:us:check` commands plus CI enforcement for committed U.S. history.
- Regression coverage for Nasdaq payload normalization, provider OHLC quirks, unavailable volume, and split restoration.

### Changed
- Replaced Alpha Vantage as the production U.S. price source with Nasdaq Historical Quotes; third-party price feeds are verification-only.
- Nasdaq provider OHLC fields are preserved verbatim rather than clamped when the official historical response contains cross-field inconsistencies.
- Nasdaq-reported unavailable historical volume is preserved as `null` instead of being fabricated as zero; KRX numeric volume validation remains strict.
- U.S. split-adjusted history is converted back to raw historical prices only when verified split ratios and surrounding prices support the adjustment classification; corporate actions remain separate gameplay events.
- Authoritative refresh tooling, development rules, environment examples, README, and data-pipeline documentation now use KRX + Nasdaq + Bank of Korea as the production source stack.
- App version advanced to `v0.15.0`; save schema remains v9.

## [0.14.2] - 2026-08-25

### Added
- Responsive Playwright density checks that cap the home total-assets headline size, verify mobile news content reaches the initial viewport above the fixed navigation, and capture viewport screenshots for visual QA.

### Changed
- Reduced the home total-assets headline size and tightened investment, net-assets, cash, loan, market, news, and corporate-event spacing so substantially more information is visible before scrolling.
- Reduced mobile app-header whitespace and compacted the floating game-progress trigger without shrinking its touch target below 44px.
- App version advanced to `v0.14.2`; save schema remains v9 and game/data calculation rules are unchanged.

## [0.14.1] - 2026-08-25

### Added
- On-demand game-progress popup with responsive bottom-sheet/modal presentation, keyboard focus management, Escape/backdrop dismissal, and a compact persistent trigger.
- Component and Playwright coverage that verifies progress controls stay out of the home layout until requested and remain usable across supported viewports.

### Changed
- Removed the always-visible home time-progress panel so investment, market, news, and event content remain the primary dashboard layout.
- The compact game-progress trigger reflects the current phase action or autoplay state while reusing the existing deterministic date, market-session, and autoplay logic unchanged.
- App version advanced to `v0.14.1`; save schema remains v9 and game/data calculation rules are unchanged.

## [0.14.0] - 2026-08-25

### Added
- Mobile-first application shell with compact brand/date header and reusable SVG icon navigation for all five primary screens.
- Shared UI primitives for section headers, compact empty states, segmented controls, account rows, and deterministic market/asset avatars.
- Dedicated home dashboard controller and presentational components for investment, cash, loan, market, news, corporate-event, and time-progress sections.
- Responsive Playwright coverage at 360×800, 390×844, 768×1024, and 1280×800 with overflow, touch-target, navigation, and visual screenshot checks.
- Portfolio holding-row component coverage for valuation, profit/loss, and price-source presentation.

### Changed
- Replaced the blue dashboard styling with a neutral near-black design-token system, flat section hierarchy, restrained surfaces, tabular financial numerals, red gains, and blue losses.
- Reworked home around the investment headline, compact cash/loan rows, real market status, concise news/event feeds, and one phase-aware primary time action.
- Removed the decorative placeholder market chart, large dashed empty states, repeated bordered cards, floating capsule navigation, and player-facing save-schema debug footer.
- Reworked market, portfolio, news, exchange, loan, and asset-management screens around dense list/row patterns with reduced borders and clearer numerical hierarchy.
- Autoplay speed selection now uses an accessible segmented control while preserving the existing deterministic progression and stop rules.
- Bottom navigation now uses explicit icons and labels, `aria-current`, safe-area padding, and 44px-or-larger touch targets; desktop uses the same navigation model without duplicating routes.
- App version advanced to `v0.14.0`; save schema remains v9.

## [0.13.0] - 2026-08-25

### Added
- Explicit persisted trading-session lifecycle: `preopen` → `opened` → `closed`.
- Pure TypeScript market-session transition engine and tests that prevent advancing a trading date before close.
- Session-aware market controls that allow opening a day even with zero orders, execute queued orders once at the actual open, then expose a separate close action.
- Phase-aware asset detail pricing: previous close before open, same-day open during the session, and full same-day OHLC only after close.
- Close-price portfolio valuation and a distinct `today-close` valuation source.
- Async-safe autoplay ticks that drive trading days through open → close → date advance without overlapping price loads.
- Shared market-open execution-context builder so manual market controls and autoplay use the same price/settlement loading path.
- `docs/MARKET_SESSION.md` documenting the no-lookahead session state machine and autoplay behavior.

### Changed
- A trading date must be closed before `+1일`, `+1주`, or `+1개월` can advance; joint-market holidays remain directly advanceable.
- Candlestick charts keep the current day's full bar hidden during both `preopen` and `opened` and include it only after `closed`.
- Portfolio holdings now label close-based valuations separately from previous-close and same-day-open valuations.
- Save schema advanced from v8 to v9 to persist the new `closed` market-session phase; older saves migrate automatically.
- App version advanced to `v0.13.0`.

## [0.12.0] - 2026-08-25

### Added
- Initial source-backed 2018 historical-news dataset with 10 company, monetary-policy, and trade-policy items using original StockLab article text.
- Verified K001 50:1 stock-split, trading-suspension, and trading-resumption corporate events from Samsung Electronics disclosures.
- `curated-partial` corporate-event source mode so verified partial history cannot be mistaken for comprehensive generated coverage.
- Effective-date KRX endpoint transitions in the private source-map format and history builder, covering assets that changed Korean market venue during the game period.
- Private source-map template generator that includes provider/endpoint structure while leaving real symbols blank.
- Historical data coverage report with optional strict 109-asset market-coverage enforcement.
- Manual GitHub Actions workflow that builds KRX, Alpha Vantage, and Bank of Korea data from repository secrets, validates it, uploads an artifact, and pushes changes to a review branch.
- Unit tests for dated KRX endpoint transitions and stronger HTTPS/asset/date validation for curated news and corporate actions.
- `docs/DATA_COVERAGE.md` documenting completeness modes, private mapping, workflow secrets, and authoritative refresh rules.

### Changed
- CI now reports historical-data coverage in addition to validating each static dataset.
- `AGENTS.md` now requires explicit completeness metadata, dated KRX venue handling, and PR review for generated provider data.
- README now documents the initial curated 2018 content and the authoritative refresh workflow.
- App version advanced to `v0.12.0`; save schema remains v8.

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
- Responsive asset/FX screen with KRW and USD balances, reference/applied rates, quote preview, exchange history.
- Persisted exchange history with deterministic exchange IDs.
- Unit tests for ECOS normalization, FX-date selection, spread calculation, exchange execution, and save migration.
- `docs/FX_DATA.md` documenting source, build, runtime, and game-pricing rules.

### Changed
- Save schema advanced from v2 to v3 with automatic migration; existing positions, pending orders, settlements, trades, and FX history are preserved while FX history is initialized.
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
- Advancing the game date now credits due settlements, resets the session to preopen, and cancels unexecuted same-day orders.
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
- Unit tests for market-calendar progression, schema validation, and lazy data loading.
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
- Mobile-first responsive dashboard shell for phone, tablet and desktop layouts.
- Single-slot local save foundation using `stocklab.save` and save schema version 1.
- Initial game state: 2018-01-01, KRW 10,000,000 cash, USD 0, WS Bank loan KRW 10,000,000.
- In-app application version and save-schema indicators.
- CI workflow with lint, typecheck, unit tests, production build, and responsive Playwright smoke tests.
- Initial development and data-source governance in `AGENTS.md`.