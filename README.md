# StockLab

Historical stock-trading web game that begins on **2018-01-01** with **KRW 10,000,000 borrowed from WS Bank**.

The player trades masked Korean and U.S. stocks and ETFs using historical daily market data while managing settlement delays, KRW/USD cash, variable-rate loan interest, dated trading costs, corporate actions, historical news, and manual FX without access to future information.

## Current version: v0.15.2

- React + TypeScript + Vite application deployed under GitHub Pages `/StockLab/`.
- Mobile-first responsive UI for phone, tablet, and desktop.
- One persistent local save at `stocklab.save`; current save schema is **v9** with migrations from older saves.
- Pure TypeScript Korean/U.S. market-calendar and game-date engine.
- Explicit daily session state machine: **pre-open → opened → closed → next game date**.
- Full same-day OHLC remains hidden until `closed`; only the actual open is revealed during `opened`.
- Autoplay runs through the same open/close session transitions rather than skipping directly between dates.
- Stable masked catalog of **109 assets**: 40 Korean stocks, 45 U.S. stocks, 12 Korean ETFs, and 12 U.S. ETFs.
- Production price-source policy is **KRX for Korea and Stooq for the U.S.**; execution prices are raw/unadjusted OHLC.
- The legacy mixed KRX Open API / Alpha Vantage tooling remains temporarily during migration and must not be used to publish new U.S. production history.
- Bank of Korea ECOS USD/KRW and BOK base-rate ingestion/validation pipelines.
- Responsive market browser, masked-name search/filtering, details, and no-lookahead candlestick charts.
- Pre-open market orders with actual same-day open execution, whole-share enforcement, and historical settlement delays.
- Date-effective Korean transaction/rural-special taxes and U.S. Section 31/FINRA TAF sell costs.
- Pure TypeScript corporate-action engine for dividends, splits/reverse splits, mergers, listings/delistings, halts, and resumptions.
- Verified 2018 corporate events currently include the K001 50:1 split and its trading halt/resumption schedule; the corporate dataset is explicitly marked `curated-partial` until comprehensive events are assembled.
- Historical-news layer with `PRE_OPEN` / `INTRADAY` / `POST_CLOSE` reveal timing, read state, detailed game-written articles, and important-news stops.
- Initial curated 2018 news set uses official Samsung Electronics, Federal Reserve, Bank of Korea, USTR, and Microsoft sources.
- Manual and automatic timeline progression with **1× / 2× / 5× / 10×** autoplay speeds.
- Autoplay stops on important corporate events, important news, WS Bank automatic-debit failure, and game over.
- Portfolio valuation engine using only historically known prices: previous close before open, current-day open during the session, and current-day close only after market close.
- KRW-equivalent total assets, net worth, realized/unrealized P&L, cumulative fees, and loan-repayment-neutral strategy return.
- Return-based badge progression from `회복 모드` through `월가의 전설`.
- Manual KRW ↔ USD exchange using the fictional WS Securities 1.00% base spread with 95% preferential pricing (0.05% effective spread).
- WS Bank loan engine: BOK base rate + 3.0%p, daily accrual, monthly billing, retry, overdue pricing, principal repayment, and three-month-delinquency game over.
- CI validates code, market/FX/rate/corporate/news datasets, reports historical-data coverage, builds production assets, and runs mobile/tablet/desktop Playwright flows.

The committed market dataset remains a **bootstrap/incomplete seed** until the controlled KRX and Stooq production pipelines populate authoritative history. Historical stock/ETF/FX values are never fabricated. The base-rate file contains a small Bank of Korea-verified 2018 bootstrap. Corporate actions are incomplete by design until comprehensive official event data is assembled; source completeness is stated explicitly rather than inferred.

## Data-source policy

- Korean stocks/ETFs: KRX official data.
- U.S. stocks/ETFs: Stooq.
- USD/KRW FX: Bank of Korea ECOS.
- Korean base rate: Bank of Korea ECOS (`722Y001` / `0101000`).
- Historical statutory/regulatory trading-cost rules: official Korean law/KRX, SEC, and FINRA sources.
- Corporate actions remain separate from raw OHLC and carry per-event source metadata.
- Historical news stores facts plus original StockLab-written summaries/articles; full third-party articles are never copied into the game dataset.
- Executions use unadjusted OHLC values. Dividends, splits, mergers, and similar actions are processed separately.
- Future price, news, event, or performance information must never be exposed before its in-game reveal time.
- Provider credentials and real ticker mappings are build-time only and must not be shipped to the browser.
- Market histories from different providers must never be silently mixed to fill gaps.

## Core game rules implemented

- Whole shares only; no margin, short selling, or fractional stock orders.
- Orders are submitted pre-open and execute at that day's actual unadjusted open.
- A trading date cannot advance until its session has opened and closed; holidays skip the session requirement.
- During `preopen`, the current day's OHLC is hidden. During `opened`, only that day's open is known. During `closed`, the complete OHLC bar becomes available to charts and valuation.
- Amount buys resize to the maximum affordable whole-share quantity after commission.
- Quantity buys cancel if a gap makes the requested quantity unaffordable.
- Sell proceeds enter a settlement queue and are not spendable until settlement.
- WS Securities representative commissions: Korea 0.015%, U.S. 0.07%.
- Korean stock sells apply the tax rule effective on the trade date; Korean ETFs are exempt from securities transaction tax.
- U.S. sells apply date-effective Section 31 and FINRA TAF pass-through costs.
- Dividend cash, splits, mergers, halts, resumptions, and delistings are processed through separate corporate events.
- `PRE_OPEN` information can be used for that day's decision; `INTRADAY`/`POST_CLOSE` information is revealed on the next game day.
- Important corporate events and important news interrupt progression and require acknowledgement.
- Autoplay supports 1×, 2×, 5×, and 10× and pauses automatically for important events, loan-payment failures, or game over.
- KRW/USD exchange is manual; USD is never auto-converted for WS Bank interest.
- WS Bank contract rate is BOK base rate + 3.0%p; insufficient monthly interest cash triggers business-day retries and delinquency handling.
- Strategy return uses `current gross assets + cumulative loan principal repaid` against the original KRW 10,000,000, so principal repayment is not misclassified as an investment loss.
- Net worth is shown separately as gross assets minus remaining loan principal and accrued/past-due interest.

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

Fill every real `symbol` outside version control and save the completed mapping as `.private/market-source-map.json`. Never commit that completed file.

Build authoritative BOK data with:

```bash
BOK_ECOS_API_KEY=... npm run data:fx:build
BOK_ECOS_API_KEY=... npm run data:rates:build
```

Do **not** use the legacy mixed-provider refresh path to publish U.S. market history. U.S. production history must come from Stooq, while the Korean migration uses the dedicated KRX production path. Generated provider data must be reviewed through a branch/PR and pass the repository quality gates before entering `main`.

Playwright browser binaries are installed separately with:

```bash
npx playwright install chromium
```

## Versioning

StockLab follows Semantic Versioning (`MAJOR.MINOR.PATCH`). During initial development the project uses `0.x.y` versions. Every release must update `CHANGELOG.md`.

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
