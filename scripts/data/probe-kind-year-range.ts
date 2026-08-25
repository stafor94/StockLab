import {
  normalizeKrxKindHistoricalResponse,
  parseKrxKindIssuerInfo,
} from '../../src/data/ingestion/krxKindHistorical'
import {
  fetchKrxKindHistoricalResponse,
  fetchKrxKindIssuerLookup,
  openKrxKindSession,
} from './providers/krx-kind'

const common = { cacheRoot: '.cache/probe-kind-year', force: true, delayMs: 0 }

async function probe(symbol: string): Promise<void> {
  const issuer = parseKrxKindIssuerInfo(await fetchKrxKindIssuerLookup(symbol, common), symbol)
  const session = await openKrxKindSession(issuer.issuerCode, 0)
  const text = await fetchKrxKindHistoricalResponse({
    ...common,
    symbol,
    issuerCode: issuer.issuerCode,
    from: '2018-01-01',
    to: '2018-12-31',
    session,
  })
  const bars = normalizeKrxKindHistoricalResponse(text, { from: '2018-01-01', to: '2018-12-31' })
  if (bars.length < 200) throw new Error(`${symbol} yearly response is unexpectedly short: ${bars.length}`)
  if (bars[0].date < '2018-01-01' || bars.at(-1)!.date > '2018-12-31') {
    throw new Error(`${symbol} yearly response escaped the requested range`)
  }
  console.log(JSON.stringify({ symbol, issuer: issuer.issuerCode, count: bars.length, first: bars[0], last: bars.at(-1) }))
}

await probe('005930')
await probe('069500')
