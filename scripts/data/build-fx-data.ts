import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeBokEcosUsdKrw } from '../../src/data/ingestion/bokFxNormalizer'
import type { FxRateSeries } from '../../src/types/fx'
import { writeJsonAtomic } from './io'
import { fetchBokEcosUsdKrwPayload } from './providers/bok-ecos'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const DEFAULT_FROM = '2018-01-01'

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
  if (!apiKey) throw new Error('BOK_ECOS_API_KEY is required for Bank of Korea ECOS FX data')
  const from = assertIsoDate(cliValue('from') ?? process.env.MARKET_DATA_FROM ?? DEFAULT_FROM, 'from')
  const to = assertIsoDate(cliValue('to') ?? process.env.MARKET_DATA_TO ?? new Date().toISOString().slice(0, 10), 'to')
  if (from > to) throw new Error('from must not be after to')

  const payload = await fetchBokEcosUsdKrwPayload({
    apiKey,
    from,
    to,
    cacheRoot: join(ROOT, '.cache', 'market-data'),
    force: process.argv.includes('--force'),
  })
  const rates = normalizeBokEcosUsdKrw(payload)
  if (rates.length === 0) throw new Error('BOK ECOS produced no USD/KRW rates')

  const series: FxRateSeries = {
    schemaVersion: 1,
    pair: 'USD/KRW',
    coverage: { from: rates[0].date, to: rates.at(-1)?.date ?? rates[0].date },
    rates,
    source: {
      provider: 'Bank of Korea ECOS',
      statCode: '731Y001',
      itemCode: '0000001',
      generatedAt: new Date().toISOString(),
    },
  }
  await writeJsonAtomic(join(ROOT, 'public', 'data', 'fx', 'usd-krw.json'), series)
  console.log(`Wrote ${rates.length} BOK USD/KRW daily rates`)
}

await main()
