# StockLab

Historical stock-trading web game that begins on **2018-01-01** with **KRW 10,000,000 borrowed from WS Bank**.

The player trades masked Korean and U.S. stocks and ETFs using historical daily market data while managing settlement delays, KRW/USD cash, variable-rate loan interest, date-effective trading taxes/fees, corporate actions, dated news, and manual FX without access to future stock prices.

## Current version: v0.9.0

- React + TypeScript + Vite application foundation.
- GitHub Pages base path: `/StockLab/`.
- Mobile-first responsive shell for phone, tablet, and desktop.
- One persistent local save at `stocklab.save`; current save schema is v6 with migrations from older saves.
- Pure TypeScript Korean/U.S. market-calendar engine.
- Stable masked catalog of **109 assets**: 40 Korean stocks, 45 U.S. stocks, 12 Korean ETFs, and 12 U.S. ETFs.
- Build-time KRX Open API and Alpha Vantage raw OHLCV ingestion pipeline with resumable response caching.
- Bank of Korea ECOS USD/KRW daily-rate and BOK base-rate ingestion/validation pipelines.
- Responsive market browser with masked-name search, market/ETF/sector filtering, asset details, and candlestick charts.
- Pre-open chart filtering that exposes only bars strictly earlier than the current game date.
- Pure TypeScript WS Securities market-order engine with amount/quantity buy, quantity/sell-all sell, and same-day actual-open execution.
- Korean T+2 sale settlement and U.S. historical T+2/T+1 settlement transition; unsettled proceeds are not spendable cash.
- Date-effective Korean securities transaction/rural-special taxes and U.S. Section 31/FINRA TAF sell costs, including Korean ETF exemption and historical venue changes.
- Pure TypeScript corporate-action engine for dividends, splits/reverse splits, mergers, listings/delistings, halts, and resumptions.
- No-lookahead corporate-event timing with important-event timeline stops and explicit confirmation before time can continue.
- Persistent asset trading restrictions and corporate-action history; halted/delisted assets are blocked in both store and order UI.
- Manual KRW ↔ USD exchange using a fictional WS Securities 1.00% base spread with 95% preferential pricing, for a 0.05% effective spread.
- Pure TypeScript WS Bank loan engine: BOK base rate + 3.0%p, daily accrual, monthly billing, retry after insufficient funds, overdue pricing, principal repayment, and three-month-delinquency game over.
- Responsive asset-management tabs for FX and WS Bank loan management.
- CI validation for source normalizers, asset catalog integrity, FX/rate/corporate-event schemas, static data, game rules, responsive UI, and production build.

The committed market calendar remains a **bootstrap seed** until credentials and the private ticker mapping are used to generate the full authoritative price dataset. Stock and FX histories are never fabricated. The base-rate file contains a small Bank of Korea-verified 2018 bootstrap so the initial loan loop is testable; `npm run data:rates:build` replaces it with ECOS history. The corporate-event file is intentionally an **empty schema-valid seed** until authoritative event history is assembled; fake corporate actions are never inserted as placeholders.

## Data-source policy

- Korean stocks/ETFs: official KRX data.
- U.S. stocks/ETFs: Alpha Vantage.
- USD/KRW FX: Bank of Korea ECOS.
- Korean base rate: Bank of Korea ECOS (`722Y001` / `0101000`).
- Historical statutory/regulatory trading-cost rules use official Korean law/KRX, SEC, and FINRA sources and are kept separate from market-price providers.
- Corporate actions are stored as separate dated events with per-event source metadata; Korean events use official KRX/disclosure sources, while U.S. events use Alpha Vantage event fields where appropriate plus authoritative issuer/regulatory records for uncovered event types.
- Executions use unadjusted OHLC values.
- Dividends, splits, listings, delistings, and other corporate actions are separate events and must never be baked into adjusted execution prices.
- Future stock information must not be exposed before the corresponding in-game date.
- During the pre-open phase, the current game date's stock OHLC bar must never be displayed.
- `INTRADAY` and `POST_CLOSE` corporate events become visible on the next gameplay date rather than leaking into the earlier pre-open decision.
- Provider credentials and actual ticker mappings are build-time only and must not be shipped to the browser.

## Trading, FX, loan, and event rules implemented

- Whole shares only; no margin, leverage, shorts, or fractional shares.
- Orders are submitted before the market opens and execute at that game's actual unadjusted open.
- Amount buys resize to the maximum affordable whole-share quantity after WS commission.
- Quantity buys cancel if the actual open makes the requested quantity unaffordable.
- Sell proceeds enter a settlement queue and become cash only on the applicable market settlement date.
- WS Securities representative commissions: Korea 0.015%, U.S. 0.07%.
- Korean stock sells apply the tax rate effective on that trade date; KOSPI also applies the rural special tax and Korean ETFs are exempt from securities transaction tax.
- U.S. stock/ETF sells apply the date-effective Section 31 and FINRA TAF pass-through schedules.
- Dividend cash uses the withholding rate stored on that authoritative corporate event.
- Splits and reverse splits preserve book value; fractional entitlements require an explicit cash-in-lieu price rather than silent rounding loss.
- Halts cancel pending orders and block new orders; resumptions re-enable trading.
- Delistings block trading and only cash out holdings when an authoritative cash-out price is supplied.
- Important corporate events interrupt multi-day progression and require acknowledgement.
- KRW/USD exchange is manual and available during the pre-open phase.
- WS Securities FX pricing uses a 1.00% base spread, 95% preferential discount, and 0.05% effective spread.
- U.S. holdings are never auto-converted to KRW for loan-interest payments.
- WS Bank contract rate is the applicable BOK base rate + 3.0%p and accrues daily.
- Monthly interest is auto-debited on the first WS Bank business day; insufficient funds trigger full-balance retry on subsequent business days.
- Overdue pricing adds 3.0%p to the contract rate, capped at 15% annually, on unpaid billed interest.
- Three consecutive monthly payment failures cause game over.
- Principal can be prepaid in KRW 1,000,000 increments; full payoff also settles accrued unbilled interest.

See `docs/DATA_PIPELINE.md` for stock/ETF ingestion, `docs/TRADING_COSTS.md` for historical execution costs, `docs/CORPORATE_EVENTS.md` for corporate-event timing/effects, `docs/FX_DATA.md` for FX rules, and `docs/LOAN_RULES.md` for loan formulas and lifecycle rules.

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
npm run build
npm run test:e2e
```

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
