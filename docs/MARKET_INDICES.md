# Major market indices

StockLab keeps dashboard market indices separate from tradable asset price histories. Index values are informational only and never participate in order execution, portfolio valuation, settlement, tax, FX, or corporate-action calculations.

## Dashboard indices

The home `오늘의 시장` section always reserves four cards:

- KOSPI (`KOSPI`) — official KRX index history
- KOSDAQ (`KOSDAQ`) — official KRX index history
- Nasdaq Composite (`NASDAQ_COMPOSITE`, Nasdaq symbol `COMP`) — Nasdaq Historical Quotes
- Dow Jones Industrial Average (`DOW_JONES`) — source-limited card; no production history is committed while the configured official U.S. source does not publish DJIA Historical Quotes

Only the first three indices currently have production history files under `public/data/indices/`. The Dow card deliberately shows an official-source limitation instead of substituting DIA, FRED, another vendor, or fabricated OHLC.

The build and validation commands are:

```bash
npm run data:indices:build
npm run data:indices:check
```

Runtime reads only the committed static files. Normal application and quality CI do not fetch market-index data from the network.

## No-lookahead display rule

The home `오늘의 시장` section uses the same persisted trading-session phase as the rest of the game, while index selection remains in a pure TypeScript market-index quote module rather than React.

For a supported index series:

- Before an open market starts, only its latest completed close is visible.
- After `장 시작`, that market's actual opening index value is visible and compared with the previous completed close.
- After `장 마감`, that market's actual closing index value is visible and compared with the previous completed close.
- If that market is closed on the current game date, the latest completed close is shown instead; no future bar is read.

The dashboard displays signed point change and signed percentage change. Existing StockLab gain/loss tokens are reused: gains are red and losses are blue. Sign and percentage text remain present so color is not the only directional cue.

## Data policy

Korean index history must come from official KRX data. Supported U.S. index history must come from Nasdaq Historical Quotes. Third-party providers may be used only to investigate or verify source behavior and must never be mixed into committed production index files.

The configured Nasdaq Historical Quotes public API does not expose Dow Jones Industrial Average history under the tested DJIA identifiers. The S&P Dow Jones Indices public site also blocks automated history downloads from CI. StockLab therefore does not create a `DOW_JONES` production series until an approved official source is available under the project data policy.

Missing official sessions in a supported series are fatal during generation and validation. StockLab does not forward-fill, interpolate, proxy, or fabricate index OHLC values. Supported index datasets include completed carry-in sessions before the first playable trading date so the first visible previous-close comparison does not require future information.
