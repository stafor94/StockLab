# News system

StockLab news is a curated historical-information layer for investment decisions, not a copy of third-party articles. The player-facing copy must contain only information that was public at the point when the item becomes visible in the game.

## No-lookahead timing

Every item has an event/publication `date` and one of three timing values:

- `PRE_OPEN`: information verified as available before the relevant regular session. It is visible on that game date, or on the next game date when the publication date is a weekend/holiday.
- `INTRADAY`: information released during a regular session. It becomes visible on the next game date.
- `POST_CLOSE`: information released after the relevant regular-session close. It becomes visible on the next game date.

`getNewsRevealDate` is the single reveal rule used by the home feed, the news screen, and important-news autoplay stops. When an exact timestamp or Korea/U.S. session mapping is uncertain, curate conservatively as `INTRADAY` or `POST_CLOSE` so the game reveals it on the next game date rather than risking early disclosure.

A source may announce a future effective date (for example, a scheduled regulation or transaction closing). That announced schedule may be described because it was already public. Later outcomes, later price reactions, or facts not known at the item publication time must never be backfilled into earlier copy.

## Source and writing policy

Prefer primary/official material:

- Korea: Bank of Korea, Financial Services Commission, Ministry of Economy and Finance, KRX/DART, and company IR/disclosures.
- U.S./global: Federal Reserve, SEC, U.S. Treasury, USTR, White House/government agencies, WHO/IEA when relevant, Nasdaq, and company IR/newsrooms.
- Reuters/AP or another high-quality contemporary report may be used only as secondary evidence when necessary; the event date and core claim should still be tied to an official source when one exists.

For each item:

- write an original StockLab `headline`, `summary`, and `article`; do not reproduce article text;
- keep one or more HTTPS `sourceReferences` for curator traceability;
- use masked StockLab asset IDs and aliases in player-facing copy rather than real catalog company identities;
- keep `relatedAssetIds` and `relatedSectors` limited to genuinely exposed assets/sectors;
- do not write retrospective phrases such as later price performance, eventual outcomes, or future policy paths as if they were known at the earlier date.

## Important-news policy

`important: true` pauses timeline autoplay at the item's reveal date until the player acknowledges the alert. It is reserved for events that justify interrupting play, such as pandemic-scale shocks, abrupt market-structure restrictions, large monetary-policy regime changes, major trade/export-control shifts, or similarly material company events.

Routine earnings, ordinary policy meetings, and incremental follow-up actions should normally remain `important: false`. Importance is gameplay metadata, not a claim that non-important items were economically irrelevant.

## Year files and loading

`public/data/news/manifest.json` registers one JSON file per coverage year. The current curated coverage is 2018-01-01 through 2026-08-25, matching the game-data end date.

The browser does not fetch every historical-news file at startup. `NewsDataClient.loadThrough(date)` loads only year files up to the requested year and caches each parsed year. The news hook expands that cache when the game enters a new year. Before a manual/autoplay date jump is committed, the controller loads through the requested target date so an important event in a newly entered year cannot be skipped.

This is a curated gameplay timeline, not a claim that every market-moving story is included. Coverage should favor events that materially explain the market regime or StockLab catalog assets instead of filling arbitrary daily quotas.

## Validation and regressions

Run:

```bash
npm run data:news:check
```

The validator rejects:

- manifest/file year mismatches, missing/extra year files, duplicate years/paths, and non-contiguous coverage;
- schema-version mismatches, invalid/out-of-coverage/future dates, duplicate IDs, duplicate same-date headlines, and bad sort order;
- missing/invalid HTTPS sources, unknown related asset IDs, and incomplete important-news metadata;
- empty required strings/arrays and invalid timing/category/market values through the shared schema parser.

Unit regressions also pin representative `PRE_OPEN`, `INTRADAY`, `POST_CLOSE`, weekend-roll-forward, and expanded-copy no-lookahead cases. Any timing correction should update the historical source evidence and the corresponding regression together.
