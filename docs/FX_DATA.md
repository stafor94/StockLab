# USD/KRW FX data

StockLab uses **Bank of Korea ECOS** as the authoritative source for daily USD/KRW exchange rates.

## Series

- Provider: Bank of Korea Economic Statistics System (ECOS)
- Statistic code: `731Y001`
- Item code: `0000001`
- Frequency: daily (`D`)
- Runtime output: `public/data/fx/usd-krw.json`

The ECOS API key is build-time only. Do not expose `BOK_ECOS_API_KEY` through Vite or browser code.

## Build

```bash
BOK_ECOS_API_KEY=... npm run data:fx:build
npm run data:fx:check
```

Optional date controls use the same `MARKET_DATA_FROM` and `MARKET_DATA_TO` variables as the market-data build. Raw ECOS responses are cached under `.cache/market-data/bok-ecos/` and are not committed.

## Runtime rule

The game chooses the latest Bank of Korea rate whose date is not later than the current game date. This allows weekends and Korean holidays to reuse the latest published official rate without inventing a synthetic FX value.

## WS Securities spread

WS Securities is fictional. The game uses one representative FX rule:

- Base spread: 1.00%
- Preferential discount: 95%
- Effective spread: 0.05%

For KRW → USD, the effective spread is added to the Bank of Korea reference rate. For USD → KRW, it is subtracted. USD is rounded down to cents and KRW to whole won.

No automatic FX conversion is performed for U.S. stock purchases, settlement, or loan-interest payments.
