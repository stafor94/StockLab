# StockLab

Historical stock-trading web game that begins on **2018-01-01** with **KRW 10,000,000 borrowed from WS Bank**.

The player trades masked Korean and U.S. stocks and ETFs using historical daily market data while managing settlement delays, KRW/USD cash, variable-rate loan interest, dated trading costs, corporate actions, historical news, and manual FX without access to future information.

## Current version: v0.17.0

- React + TypeScript + Vite application deployed under GitHub Pages `/StockLab/`.
- Mobile-first responsive UI for phone, tablet, and desktop.
- One persistent local save at `stocklab.save`; current save schema is **v9** with migrations from older saves.
- Stable masked catalog of **109 assets**: 40 Korean stocks, 45 U.S. stocks, 12 Korean ETFs, and 12 U.S. ETFs.
- **All 109 market assets now have authoritative generated price history**: 52 Korean assets from official KRX-operated KIND and 57 U.S. assets from Nasdaq Historical Quotes.
- Korean coverage: 2018-01-01 through 2026-08-25 calendar coverage, using actual raw/unadjusted execution OHLCV. KIND zero-volume display-only halt rows are excluded from tradable bars.
- U.S. coverage: 2018-01-02 through the latest completed Nasdaq session available to the build, 2026-08-24. The 57 U.S. series contain 119,908 daily bars.
- Nasdaq histories are restored to the historical unadjusted price/volume scale when verified dated split ratios show provider rows are split-adjusted. The current catalog contains 11 verified split events across 9 U.S. assets.
- Nasdaq-reported unavailable historical volume is preserved as `null` rather than fabricated; the current generated dataset contains 2 such bars.
- Five U.S. assets begin after the global 2018 coverage start because their securities were not yet listed; no pre-listing prices are invented.
- Corporate actions remain separate from execution-price history. Split restoration changes only the historical price scale used for trading and does not replace split processing in the game engine.
- Explicit daily session state machine: **pre-open → opened → closed → next game date**. Full same-day OHLC remains hidden until `closed`; only the actual open is revealed during `opened`.
- Pre-open orders execute at the actual same-day unadjusted open. Portfolio valuation uses only prices known at the current game phase.
- Bank of Korea ECOS USD/KRW and base-rate pipelines, historical trading costs, corporate actions, historical news, settlement, loan, and autoplay systems remain separate from market-price ingestion.
- CI validates lint, typecheck, unit tests, Korean and U.S. market datasets, FX/rate/events/news, full coverage, production build, and responsive Playwright flows.

## Data-source policy

- Korean stocks/ETFs: **official KRX data only**, currently collected through KRX-operated KIND.
- U.S. stocks/ETFs: **Nasdaq Historical Quotes only** for production prices.
- Historical executions use actual unadjusted OHLC. If Nasdaq history is split-adjusted, the historical scale is restored only from verified dated split/reverse-split ratios.
- Dividends, splits, reverse splits, mergers, listings, delistings, and trading suspensions are separate corporate-action events.
- Third-party price sources such as Stooq may be used only for independent verification and are never mixed into production KRX/Nasdaq files.
- USD/KRW FX and Korean base rate: Bank of Korea ECOS.
- Future price, news, event, or performance information must never be exposed before its in-game reveal time.
- Real ticker mappings are private build inputs. Public runtime data contains masked game IDs/aliases and historical values, not real-symbol mappings.
- Missing prices or volume are never fabricated merely to satisfy coverage checks.

## Core game rules implemented

- Whole shares only; no margin, short selling, or fractional stock orders.
- Orders are submitted pre-open and execute at that day's actual unadjusted open.
- A trading date cannot advance until its session has opened and closed; holidays skip the session requirement.
- During `preopen`, the current day's OHLC is hidden. During `opened`, only that day's open is known. During `closed`, the complete OHLC bar becomes available to charts and valuation.
- Sell proceeds enter a settlement queue and are not spendable until settlement.
- WS Securities representative commissions: Korea 0.015%, U.S. 0.07%.
- Korean stock sells apply the tax rule effective on the trade date; Korean ETFs are exempt from securities transaction tax.
- U.S. sells apply date-effective Section 31 and FINRA TAF pass-through costs.
- Dividend cash, splits, mergers, halts, resumptions, and delistings are processed through separate corporate events.
- `PRE_OPEN` information can be used for that day's decision; `INTRADAY`/`POST_CLOSE` information is revealed on the next game day.
- Autoplay supports 1×, 2×, 5×, and 10× and pauses for important events, loan-payment failures, or game over.
- WS Bank contract rate is BOK base rate + 3.0%p with business-day retry and delinquency handling.

See `docs/MARKET_SESSION.md`, `docs/DATA_PIPELINE.md`, `docs/DATA_COVERAGE.md`, `docs/TRADING_COSTS.md`, `docs/CORPORATE_EVENTS.md`, `docs/NEWS_SYSTEM.md`, `docs/PERFORMANCE.md`, `docs/FX_DATA.md`, and `docs/LOAN_RULES.md`.

## Development

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run data:check
npm run data:kr:check
npm run data:us:check
npm run data:fx:check
npm run data:rates:check
npm run data:events:check
npm run data:news:check
npm run data:coverage
npm run build
npm run test:e2e
```

Prepare the private market-source mapping template with:

```bash
npm run data:source-map:template
```

Fill every real `symbol` outside version control and save the completed mapping as `.private/market-source-map.json`. Korean entries use six-digit KRX codes. U.S. entries use Nasdaq symbols plus the required `assetClass` (`stocks` or `etf`). Never commit the completed mapping.

Build Korean KRX KIND history with:

```bash
npm run data:kr:build -- --from=2018-01-01 --to=2026-08-25
npm run data:kr:check
```

Build U.S. Nasdaq history with:

```bash
npm run data:us:build -- --from=2018-01-01 --to=2026-08-25
npm run data:us:check
```

Both market builders fail rather than guessing a missing real symbol. Provider requests and normalizers are build-time tooling; the browser loads only static generated datasets under `public/data/`.

Build authoritative BOK data with:

```bash
BOK_ECOS_API_KEY=... npm run data:fx:build
BOK_ECOS_API_KEY=... npm run data:rates:build
```

Playwright browser binaries are installed separately with:

```bash
npx playwright install chromium
```

## Versioning

StockLab follows Semantic Versioning (`MAJOR.MINOR.PATCH`). During initial development the project uses `0.x.y` versions. Every release updates `CHANGELOG.md`.

## Data layout

```text
public/data/
├─ manifest.json
├─ stocks/kr/
├─ stocks/us/
├─ etf/kr/
├─ etf/us/
├─ fx/
├─ rates/
├─ calendars/
├─ events/
└─ news/
```

The public runtime data exposes game IDs and aliases only. Real ticker mappings used by ingestion tooling live outside version control in `.private/market-source-map.json`.
