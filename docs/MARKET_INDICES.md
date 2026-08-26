# Major market indices

StockLab keeps dashboard market indices separate from tradable asset price histories. Index values are informational only and never participate in order execution, portfolio valuation, settlement, tax, or corporate-action calculations.

## Included indices

- KOSPI (`KOSPI`) — KRX Data Marketplace
- KOSDAQ (`KOSDAQ`) — KRX Data Marketplace
- Nasdaq Composite (`NASDAQ_COMPOSITE`) — Nasdaq Historical Quotes

Generated files live under `public/data/indices/` behind a dedicated manifest. The build commands are:

```bash
npm run data:indices:build
npm run data:indices:check
```

## No-lookahead display rule

The home `오늘의 시장` section uses the same persisted trading-session phase as the rest of the game, but index selection is handled by a pure market-index quote module rather than React.

- Before an open market starts, only its latest completed close is visible.
- After `장 시작`, that market's actual opening index value is visible and compared with the previous completed close.
- After `장 마감`, that market's actual closing index value is visible and compared with the previous completed close.
- If that market is closed on the current game date, the latest completed close is shown instead; no future bar is read.

The dashboard displays both signed point change and signed percentage change. Existing StockLab gain/loss tokens are reused: gains are red and losses are blue. Sign and percentage text remain present so color is not the only directional cue.

## Data policy

Korean index history must come from official KRX data. U.S. index history must come from Nasdaq Historical Quotes. Third-party providers may be used only to verify suspicious rows and must never be mixed into committed production index files.

Missing official sessions are fatal during generation/validation. StockLab does not forward-fill, interpolate, or fabricate index OHLC values. Index datasets include completed carry-in sessions before the first playable trading date so the first visible previous-close comparison does not require future information.
