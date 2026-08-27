# StockLab Development Rules

## Product
StockLab is a historical stock-trading web game. It is a static React web app deployed with GitHub Pages. Persistent play data is stored locally in the browser. There is exactly one game save slot.

## Agent workflow and instruction priority
- Read this `AGENTS.md` before investigating or modifying the repository. Treat it as the repository-level development contract for every task.
- Follow the user's explicit task requirements first. Within that scope, follow this file and then the existing local conventions of the code being changed.
- Start from the latest `main`. Confirm the current `main` SHA and canonical `package.json` version once at the start of a task; do not repeatedly re-check them during normal iteration unless `main` may have changed.
- Inspect the existing implementation before editing, but keep exploration proportional to the requested change. Read neighboring modules and tests that can materially affect correctness; do not inventory unrelated areas of the repository by default.
- Keep small changes small. A local UI correction should not grow into data-pipeline, CI, release-automation, architecture, or unrelated refactoring work unless that expansion is required to make the requested behavior correct.
- Do not perform drive-by cleanup, dependency upgrades, formatting sweeps, workflow redesigns, or speculative abstractions while implementing an unrelated feature or fix.
- If the apparent solution starts crossing additional architectural layers, first re-evaluate whether each layer is actually required by the requested behavior. Prefer the narrowest complete solution over a broader "while here" improvement.
- Do not modify `.github/workflows`, release automation, market-data generators, provider ingestion, or save-schema infrastructure merely to support or validate an otherwise unrelated UI/gameplay change.
- When infrastructure genuinely must change, keep it minimal and preferably isolate it from product behavior so failures and reviews remain attributable.

## Validation discipline
- Validation effort must be proportional to the change during iteration. Run the narrowest relevant checks first, then run the full required release gate once the implementation is stable.
- Pure UI/style changes: run targeted component/unit checks when present and only the focused E2E coverage needed to prove the affected behavior. Do not add brittle E2E assertions for incidental styling when existing coverage already protects the behavior.
- Pure game/calculation changes: run the directly related pure TypeScript unit tests and typecheck first. Run UI/E2E coverage only where the user-visible flow or integration boundary is affected.
- Market-data changes: run the relevant market-specific builder/validator and source-policy checks. Do not run or modify unrelated market pipelines merely because they exist.
- Save-schema changes: add/adjust migration tests and verify preservation of previous saves.
- Before merging a release-intended change into `main`, the required repository gates are lint, typecheck, unit tests, build, and the major relevant E2E tests.
- Do not repeatedly run the entire test matrix after every small edit when a focused check can establish the intermediate result.
- A regression test should reproduce a meaningful behavioral bug or contract. Prefer stable unit/integration coverage over expensive browser coverage when both protect the same rule.

## Release hygiene
- Treat implementation, validation, and release bookkeeping as separate concerns even when they land in one PR.
- Do not bump the application version or finalize a release changelog repeatedly during implementation. Make release bookkeeping once, after the functional change is stable and the intended release scope is known.
- Documentation-only, test-only, or internal-tooling commits do not require an application version bump unless they are intentionally part of a new product release.
- PR/CI validation should be read-only with respect to source whenever practical. Avoid workflows that modify tracked files and push new commits as a side effect of ordinary validation, because they can create CI/commit churn.

## Market data authority
- Korea equities and Korea ETFs: KRX official data. The production historical-price collector uses KRX-operated KIND.
- U.S. equities and U.S. ETFs: Nasdaq Historical Quotes.
- Do not mix market-price providers within one market history and do not use a legacy or third-party provider to fill production gaps.
- Historical executions use actual unadjusted OHLC prices. Do not silently replace them with adjusted prices.
- If Nasdaq Historical Quotes returns split-adjusted historical rows, restore the historical unadjusted price and volume scale only with verified dated split/reverse-split ratios and regression validation.
- Dividends, stock splits, reverse splits, mergers, listings, delistings, and trading suspensions are separate dated corporate-action events; price-scale restoration does not replace corporate-action processing.
- USD/KRW exchange-rate and Bank of Korea base-rate series are separate static datasets sourced from Bank of Korea ECOS.
- Third-party market sources such as Stooq may be used for verification only and must never be mixed into production KRX/Nasdaq price files.

## Historical data completeness
- Never fabricate missing prices, volume, FX, rates, corporate actions, or news to make a screen look complete.
- Treat data completeness as explicit metadata and validation, not an assumption.
- `curated-partial` corporate-action data means every included event is verified, but the dataset is not comprehensive. Do not relabel it `generated` until the configured coverage is actually complete.
- A full market-data refresh must cover all catalog assets and generated KR/US calendars before it is considered production-ready.
- Korean private mappings must retain effective-date venue metadata when required by tax, trading-cost, or historical market-classification rules. KRX KIND price ingestion itself follows the security's issuer series across venue changes.
- Real symbols and provider credentials remain private build inputs. Public runtime data may contain only game IDs, aliases, derived historical data, and non-secret source metadata.
- Generated provider data should be reviewed through a branch/PR and must not bypass CI to update `main`.

## Information boundary
- The player may never see price, chart, news, event, or performance information from after the current game time.
- Every trading date follows `preopen` → `opened` → `closed`; a trading date must reach `closed` before time advances.
- During `preopen`, the current date's open/high/low/close are all hidden and valuation uses the latest previous close.
- During `opened`, only the current date's actual unadjusted open may be exposed; high, low, and close remain hidden. Immediate orders may execute only at that open price.
- During `closed`, the current date's full unadjusted OHLC bar may be exposed and portfolio valuation may use the current close. Immediate orders may execute only at that close price.
- Pre-open orders use only information available before that session opens and execute once at that session's actual open price.
- `PRE_OPEN` information may appear on that game date; `INTRADAY` and `POST_CLOSE` information is revealed only on the next game date.
- Important corporate events, important news, payment failures, and game-over conditions must interrupt autoplay and clearly identify why progression stopped.

## News content
- Historical news must be curated from verifiable sources and stored separately from market-price data.
- Never copy full third-party news articles into the repository. Store source references, factual summaries, and original StockLab-written article text.
- Player-facing news uses masked game IDs/aliases and must not intentionally leak real company identities.
- Do not add fabricated news merely to populate the UI; an empty validated dataset is preferable.
- Every curated news item must retain at least one HTTPS source reference and must be ordered by historical publication date.

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
- UI reads game state and invokes explicit game-engine operations; it does not contain settlement, tax, loan, corporate-action, or news-reveal formulas.
- Static historical datasets live under `public/data/` and are loaded lazily where practical.
- Game-facing asset IDs are opaque internal IDs. Real ticker mappings used to build masked datasets must not be shipped to the public game when avoidable.
- Keep provider-specific network/normalization code outside React and separate from game calculation rules.
- Keep Korean and U.S. ingestion entry points independent so changing one market's provider cannot silently alter the other market's dataset.
- Keep autoplay timing/UI state separate from deterministic game-date advancement so speed changes cannot alter game economics.
- Manual and autoplay session opening must share the same market-open context builder so execution prices and settlement dates cannot diverge by UI path.

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
