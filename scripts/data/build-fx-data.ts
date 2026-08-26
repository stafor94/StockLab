import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOK_USD_KRW_SERIES } from '../../src/data/fxSeries'
import { normalizeBokEcosUsdKrw } from '../../src/data/ingestion/bokFxNormalizer'
import type { FxRateSeries } from '../../src/types/fx'
import { writeJsonAtomic } from './io'
import { fetchBokEcosUsdKrwPayload } from './providers/bok-ecos'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_FROM = '2018-01-01'
const CARRY_IN_LOOKBACK_DAYS = 14

function cliValue(name: string): string | null {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : null
}

function assertIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must use a valid YYYY-MM-DD date`)
  }
  return value
}

function shiftDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function main(): Promise<void> {
  const apiKey = process.env.BOK_ECOS_API_KEY
  if (!apiKey) throw new Error('BOK_ECOS_API_KEY is required for Bank of Korea ECOS FX data')
  const from = assertIsoDate(cliValue('from') ?? process.env.MARKET_DATA_FROM ?? DEFAULT_FROM, 'from')
  const to = assertIsoDate(cliValue('to') ?? process.env.MARKET_DATA_TO ?? new Date().toISOString().slice(0, 10), 'to')
  if (from > to) throw new Error('from must not be after to')

  const queryFrom = shiftDays(from, -CARRY_IN_LOOKBACK_DAYS)
  const payload = await fetchBokEcosUsdKrwPayload({
    apiKey,
    from: queryFrom,
    to,
    cacheRoot: join(ROOT, '.cache', 'market-data'),
    force: process.argv.includes('--force'),
  })
  const fetchedRates = normalizeBokEcosUsdKrw(payload)
  const carryIn = fetchedRates.filter((point) => point.date < from).at(-1)
  if (!carryIn) throw new Error(`BOK ECOS produced no official carry-in USD/KRW rate before ${from}`)
  const inRange = fetchedRates.filter((point) => point.date >= from && point.date <= to)
  if (inRange.length === 0) throw new Error('BOK ECOS produced no USD/KRW rates in the requested range')
  const rates = [carryIn, ...inRange]

  const series: FxRateSeries = {
    schemaVersion: 1,
    pair: 'USD/KRW',
    coverage: { from: rates[0].date, to: rates.at(-1)?.date ?? rates[0].date },
    rates,
    source: {
      ...BOK_USD_KRW_SERIES,
      generatedAt: new Date().toISOString(),
    },
  }
  await writeJsonAtomic(join(ROOT, 'public', 'data', 'fx', 'usd-krw.json'), series)
  console.log(`Wrote ${rates.length} BOK USD/KRW daily rates (${rates[0].date}..${rates.at(-1)?.date})`)
}

await main()
