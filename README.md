# StockLab

Historical stock-trading web game that begins on **2018-01-01** with **KRW 10,000,000 borrowed from WS Bank**.

The player trades masked Korean and U.S. stocks and ETFs using historical daily market data while managing settlement delays, KRW/USD cash, loan interest, taxes, fees, corporate actions, and dated news without access to future information.

## Current version: v0.5.0

- React + TypeScript + Vite application foundation.
- GitHub Pages base path: `/StockLab/`.
- Mobile-first responsive shell for phone, tablet, and desktop.
- One persistent local save at `stocklab.save`; current save schema is v2 with v1 migration.
- Pure TypeScript Korean/U.S. market-calendar engine.
- Stable masked catalog of **109 assets**: 40 Korean stocks, 45 U.S. stocks, 12 Korean ETFs, and 12 U.S. ETFs.
- Build-time KRX Open API and Alpha Vantage raw OHLCV ingestion pipeline with resumable response caching.
- Responsive market browser with masked-name search, market/ETF/sector filtering, asset details, and candlestick charts.
- Pre-open chart filtering that exposes only bars strictly earlier than the current game date.
- Pure TypeScript WS Securities market-order engine with amount/quantity buy, quantity/sell-all sell, and same-day actual-open execution.
- Korean T+2 sale settlement and U.S. historical T+2/T+1 settlement transition; unsettled proceeds are not spendable cash.
- CI validation for source normalizers, asset catalog integrity, static data, game rules, responsive UI, and production build.

The committed calendar files are still a **bootstrap seed** until credentials and the private ticker mapping are used to generate the full authoritative dataset. No fabricated historical price data is committed as a substitute. The market browser falls back to the masked catalog and disables trading until authoritative per-asset JSON files are generated.

## Market-data policy

- Korean market: official KRX data.
- U.S. market: Alpha Vantage.
- Executions use unadjusted OHLC values.
- Dividends, splits, listings, delistings, and other corporate actions are separate events and must never be baked into adjusted execution prices.
- Future information must not be exposed before the corresponding in-game date.
- During the pre-open phase, the current game date's OHLC bar must never be displayed.
- Provider credentials and actual ticker mappings are build-time only and must not be shipped to the browser.

## Trading rules implemented

- Whole shares only; no margin, leverage, shorts, or fractional shares.
- Orders are submitted before the market opens and execute at that game's actual unadjusted open.
- Amount buys resize to the maximum affordable whole-share quantity after commission.
- Quantity buys cancel if the actual open makes the requested quantity unaffordable.
- Sell proceeds enter a settlement queue and become cash only on the applicable market settlement date.
- WS Securities representative commissions: Korea 0.015%, U.S. 0.07%.

See `docs/DATA_PIPELINE.md` for the ingestion and validation workflow.

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
npm run build
npm run test:e2e
```

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
