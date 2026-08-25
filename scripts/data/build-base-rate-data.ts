import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeBokEcosBaseRates } from '../../src/data/ingestion/bokBaseRateNormalizer'
import type { BaseRateSeries } from '../../src/types/rates'
import { writeJsonAtomic } from './io'
import { fetchBokBaseRatePayload } from './providers/bok-base-rate'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_FROM = '2018-01-01'
const CARRY_IN_FROM = '2017-11-30'

function cliValue(name: string): string | null {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : null
}

function assertIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must use YYYY-MM-DD`)
  }
  return value
}

async function main(): Promise<void> {
  const apiKey = process.env.BOK_ECOS_API_KEY
  if (!apiKey) throw new Error('BOK_ECOS_API_KEY is required for Bank of Korea base-rate data')
  const from = assertIsoDate(cliValue('from') ?? process.env.MARKET_DATA_FROM ?? DEFAULT_FROM, 'from')
  const to = assertIsoDate(cliValue('to') ?? process.env.MARKET_DATA_TO ?? new Date().toISOString().slice(0, 10), 'to')
  if (from > to) throw new Error('from must not be after to')

  const payload = await fetchBokBaseRatePayload({
    apiKey,
    from: CARRY_IN_FROM < from ? CARRY_IN_FROM : from,
    to,
    cacheRoot: join(ROOT, '.cache', 'market-data'),
    force: process.argv.includes('--force'),
  })
  const rates = normalizeBokEcosBaseRates(payload)
  if (rates.length === 0 || !rates.some((point) => point.date <= from)) {
    throw new Error('BOK ECOS produced no carry-in base rate for the game start')
  }

  const series: BaseRateSeries = {
    schemaVersion: 1,
    name: 'BOK_BASE_RATE',
    coverage: { from, to },
    rates,
    source: {
      provider: 'Bank of Korea',
      statCode: '722Y001',
      itemCode: '0101000',
      mode: 'ecos',
      generatedAt: new Date().toISOString(),
    },
  }
  await writeJsonAtomic(join(ROOT, 'public', 'data', 'rates', 'bok-base-rate.json'), series)
  console.log(`Wrote ${rates.length} BOK base-rate change points for ${from}..${to}`)
}

await main()
