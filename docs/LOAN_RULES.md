# WS Bank loan rules

StockLab starts on 2018-01-01 with KRW 10,000,000 borrowed from the fictional first-tier `WS Bank` through `WS 직장인 신용대출`.

## Rate source

- Authoritative base rate: Bank of Korea ECOS.
- ECOS table: `722Y001`.
- Item: `0101000` (한국은행 기준금리).
- Full data is generated at build time with `BOK_ECOS_API_KEY` and stored at `public/data/rates/bok-base-rate.json`.
- The committed bootstrap only covers 2018 and exists so the initial game loop and regression tests can operate. It contains the Bank of Korea's 1.50% opening rate and the 2018-11-30 increase to 1.75%. The ECOS build replaces it.

## WS Bank product rules

- Origination: 2018-01-01.
- Principal: KRW 10,000,000.
- Repayment type: bullet principal repayment with monthly interest.
- Contract rate: `BOK base rate + 3.0 percentage points`.
- Interest accrues daily using the actual rate applicable to each calendar day: `principal × annual rate / 365`.
- Interest is billed on the first WS Bank business day of each month for usage accrued through the previous day.
- WS Bank business days currently use the Korean market business-day calendar as a versioned operational calendar. The loan engine accepts business dates as input so a dedicated bank-holiday calendar can replace it without rewriting loan calculations.

## Failed payment and retry

- Only settled KRW cash can pay interest.
- USD cash is never auto-converted.
- Pending stock-sale settlements are not cash and cannot pay interest.
- If the full billed amount is unavailable, the debit fails in full; partial debits are not used.
- WS Bank retries automatically on each following bank business day.
- Once the full overdue amount is available, it is debited automatically and the consecutive-missed-month counter resets.

## Overdue charge and game over

- Overdue rate: current contract rate + 3.0 percentage points, capped at 15% per year.
- The overdue charge is applied to unpaid billed interest, not automatically to the entire loan principal.
- A failed scheduled monthly debit increments the consecutive missed-month counter.
- Successful cure before the next scheduled billing date resets the counter.
- Three consecutive monthly failures cause `GAME OVER`.

## Principal repayment

- Principal repayment is available only during pre-open and while the loan is not overdue.
- Partial repayment uses KRW 1,000,000 increments.
- No prepayment fee is charged by WS Bank.
- Full payoff also settles accrued-but-not-yet-billed interest so the loan cannot be closed while leaving hidden interest behind.

## Processing order when the game date advances

1. Credit stock-sale settlements due on the target date.
2. Process every intermediate calendar day in the loan engine.
3. Apply rate changes, monthly billing, overdue charges, and bank-business-day retries in chronological order.
4. Reset the stock market session to pre-open for the new game date.

This order is intentional: a player who sold early enough for proceeds to settle before a retry can use that settled KRW cash to cure the loan, while unsettled proceeds remain unavailable.
