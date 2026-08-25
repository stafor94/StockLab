import {
  normalizeKrxKindHistoricalResponse,
  parseKrxKindIssuerInfo,
} from '../../src/data/ingestion/krxKindHistorical'
import {
  fetchKrxKindHistoricalResponse,
  fetchKrxKindIssuerLookup,
  openKrxKindSession,
} from './providers/krx-kind'

const common = { cacheRoot: '.cache/probe-kind-halt', force: true, delayMs: 0 }
const symbol = '005930'
const issuer = parseKrxKindIssuerInfo(await fetchKrxKindIssuerLookup(symbol, common), symbol)
const session = await openKrxKindSession(issuer.issuerCode, 0)
const text = await fetchKrxKindHistoricalResponse({
  ...common,
  symbol,
  issuerCode: issuer.issuerCode,
  from: '2018-04-27',
  to: '2018-05-08',
  session,
})
console.log(JSON.stringify(normalizeKrxKindHistoricalResponse(text, { from: '2018-04-27', to: '2018-05-08' })))
