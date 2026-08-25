# StockLab Development Rules

## Product
StockLab is a historical stock-trading web game. It is a static React web app deployed with GitHub Pages. Persistent play data is stored locally in the browser. There is exactly one game save slot.

## Market data authority
- Korea equities and Korea ETFs: KRX official data.
- U.S. equities and U.S. ETFs: Alpha Vantage.
- Historical executions use unadjusted OHLC prices. Do not silently replace them with adjusted prices.
- Dividends, stock splits, reverse splits, mergers, listings, delistings, and trading suspensions are separate dated events.
- USD/KRW exchange-rate and Bank of Korea base-rate series are separate static datasets.
- Do not mix substitute market-data websites into production datasets without an explicit project decision.

## Information boundary
- The player may never see price, chart, news, event, or performance information from after the current game time.
- Pre-open orders use only information available before that session opens and execute at that session's actual open price.
- Important events must interrupt auto progression and clearly identify why progression stopped.

## Save data
- LocalStorage key: `stocklab.save`.
- Application version and save-schema version are independent.
- Save-schema changes require an explicit migration when old saves can be retained.
- Never delete a valid save merely because the application version changed.

## Versioning
Use Semantic Versioning: `MAJOR.MINOR.PATCH`.
- PATCH: backwards-compatible bug fixes and small corrections.
- MINOR: backwards-compatible user-visible features.
- MAJOR: intentionally incompatible product or save behavior after v1.0.0.
- Development releases remain in `0.x.y` until the game is ready for v1.0.0.
- The application version in `package.json` is the canonical app version.
- Release tags use `vMAJOR.MINOR.PATCH`.

## Changelog
Every released version must be recorded in `CHANGELOG.md`.
Keep an `[Unreleased]` section at the top. Use relevant sections such as Added, Changed, Fixed, Removed, Security.
A release version must not be bumped without updating the changelog in the same change.

## Architecture
- Keep market/game calculation logic independent from React components and browser DOM APIs.
- UI reads game state and invokes explicit game-engine operations; it does not contain settlement, tax, loan, or corporate-action formulas.
- Static historical datasets live under `public/data/` and are loaded lazily where practical.
- Game-facing asset IDs are opaque internal IDs. Real ticker mappings used to build masked datasets must not be shipped to the public game when avoidable.

## Responsive UI
- Mobile-first implementation.
- Must remain usable from 320 px wide phones through tablets and desktop.
- Do not infer layout from device user-agent strings; use responsive CSS/layout capability.
- Touch targets must remain practical on mobile and tablet.
- Test representative mobile, tablet, and desktop viewports before release.

## Git workflow
- `main` represents the deployable version.
- Prefer short-lived `feature/*` and `fix/*` branches and squash merging.
- CI must pass before merging changes intended for release.
