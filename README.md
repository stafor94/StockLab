# StockLab

Historical stock-trading web game that begins on **2018-01-01** with **KRW 10,000,000 borrowed from WS Bank**.

The player trades masked Korean and U.S. stocks and ETFs using historical daily market data while managing settlement delays, KRW/USD cash, loan interest, taxes, fees, corporate actions, and dated news without access to future information.

## v0.1.0 scope

- React + TypeScript + Vite application foundation.
- GitHub Pages base path: `/StockLab/`.
- Mobile-first responsive shell for phone, tablet, and desktop.
- One persistent local save at `stocklab.save`.
- Save schema versioning independent from app SemVer.
- CI and GitHub Pages deployment workflows.
- Market-data and implementation rules in `AGENTS.md`.

## Planned game rules

- Start date: 2018-01-01; first trading session follows the actual exchange calendar.
- Initial KRW cash: 10,000,000.
- Initial WS Bank loan principal: 10,000,000.
- Korean market data: KRX official data.
- U.S. market data: Alpha Vantage.
- Real executions use unadjusted daily OHLC data.
- The player submits pre-open market orders; executions occur at the same day's actual opening price.
- KRW and USD balances are separate; exchange is bidirectional with 95% preferential FX fee treatment.
- Sale proceeds respect the historical settlement cycle before becoming withdrawable cash.
- Dividends, splits, listings, delistings, suspensions, and other corporate events are handled separately.
- Major dated events stop auto progression and surface an explicit event notice.

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

Historical data ingestion scripts and final schemas will be introduced in subsequent development versions.
