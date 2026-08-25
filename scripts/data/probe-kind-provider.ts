import {
  normalizeKrxKindHistoricalResponse,
  parseKrxKindIssuerInfo,
} from '../../src/data/ingestion/krxKindHistorical'
import {
  fetchKrxKindHistoricalResponse,
  fetchKrxKindIssuerLookup,
  openKrxKindSession,
} from './providers/krx-kind'

const cacheRoot = '.cache/probe-kind'

async function probe(symbol: string, from: string, to: string): Promise<void> {
  const common = { cacheRoot, force: true, delayMs: 0 }
  const issuer = parseKrxKindIssuerInfo(await fetchKrxKindIssuerLookup(symbol, common), symbol)
  const session = await openKrxKindSession(issuer.issuerCode, 0)
  const text = await fetchKrxKindHistoricalResponse({
    ...common,
    symbol,
    issuerCode: issuer.issuerCode,
    from,
    to,
    session,
  })
  const bars = normalizeKrxKindHistoricalResponse(text, { from, to })
  if (bars.length === 0) throw new Error(`${symbol} returned no bars`)
  console.log(JSON.stringify({ symbol, issuer, first: bars[0], last: bars.at(-1), count: bars.length }))
}

await probe('005930', '2018-04-27', '2018-05-08')
await probe('069500', '2018-01-02', '2018-01-03')
