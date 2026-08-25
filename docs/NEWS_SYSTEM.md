# News system

StockLab news is a curated historical-information layer, not a copy of third-party articles.

## No-lookahead timing

Each item has `PRE_OPEN`, `INTRADAY`, or `POST_CLOSE` timing. `PRE_OPEN` items become visible on that game day (or the next game day if published on a non-game date). `INTRADAY` and `POST_CLOSE` items become visible on the next game day. The same reveal rule is used by the home feed, full news screen, and important-news autoplay stop logic.

## Content policy

- Store the historical fact, a short summary, and original game-written article paragraphs.
- Never paste or mirror a full source article.
- Keep one or more `sourceReferences` for curator traceability.
- Use masked StockLab asset IDs and aliases in player-facing content; do not leak real company identities through the news layer.
- Important macro/market/company items may set `important: true`; reaching their reveal date pauses timeline autoplay until the player confirms the alert.

## Static layout

`public/data/news/manifest.json` lists optional year files such as `2018.json`, `2019.json`, etc. The repository currently commits an `empty-seed` manifest only. Historical articles must be added from verified source research rather than fabricated to make the UI look populated.

Validate with:

```bash
npm run data:news:check
```
